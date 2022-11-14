class Cell {
  index: number;
  richness: number;
  neighbors: number[]; // Les 6 id des voisins (-1 dans l'id si existe pas)
  neighborCells: Cell[]; // Les Cell des voisins (undefined si existe pas)
  relations: { 1: Cell[]; 2: Cell[]; 3: Cell[] }; // La liste dédoubloné des Cells par distance
  shadow: { 1: Cell[]; 2: Cell[]; 3: Cell[] }; // La liste des Cells Shadowable par distance
  available: boolean; // Case vide Seedable
  tree?: Tree; // Arbre qui occupe la case
  seedable: number; // Determine la priorité de seed. Valeur 2 si bon pattern, Valeur 1 si pas de voisin a moi, Valeur 0 si voisin
  calculatedSun: number;
  constructor(index: number, richness: number, neighbors: number[]) {
    this.index = index;
    this.richness = richness;
    this.neighbors = neighbors;
    this.available = richness !== 0;
    this.neighborCells = [];
    this.relations = { 1: [], 2: [], 3: [] };
    this.shadow = { 1: [], 2: [], 3: [] };
  }
}

class Tree {
  cell: Cell;
  size: number;
  isMine: boolean;
  isDormant: boolean;
  reachableCells: Cell[];
  maxReachableRichness: number;
  shadowMine: number;
  shadowOpponent: number;
  growShadowMine: number;
  growShadowOpponent: number;
  growRichness: number;
  constructor(cell: Cell, size: number, isMine: boolean, isDormant: boolean) {
    this.cell = cell;
    this.size = size;
    this.isMine = isMine;
    this.isDormant = isDormant;
    this.reachableCells = [];
    this.maxReachableRichness = 0;
    this.shadowMine = 0;
    this.shadowOpponent = 0;
    this.growShadowMine = 0;
    this.growShadowOpponent = 0;
    this.growRichness = 0;
  }
}

enum ActionType {
  WAIT = 'WAIT',
  SEED = 'SEED',
  GROW = 'GROW',
  COMPLETE = 'COMPLETE',
}
class Action {
  type: ActionType;
  targetCellIdx: number;
  sourceCellIdx: number;
  constructor(type: ActionType, targetCellIdx?: number, sourceCellIdx?: number) {
    this.type = type;
    this.targetCellIdx = targetCellIdx;
    this.sourceCellIdx = sourceCellIdx;
  }

  static parse(line: string): Action {
    const parts = line.split(' ');
    if (parts[0] === ActionType.WAIT) {
      return new Action(ActionType.WAIT);
    }
    if (parts[0] === ActionType.SEED) {
      return new Action(ActionType.SEED, Number(parts[2]), Number(parts[1]));
    }
    return new Action(ActionType[parts[0]], Number(parts[1]));
  }
  toString(): string {
    if (this.type === ActionType.WAIT) {
      return ActionType.WAIT;
    }
    if (this.type === ActionType.SEED) {
      return `${ActionType.SEED} ${this.sourceCellIdx} ${this.targetCellIdx}`;
    }
    return `${this.type} ${this.targetCellIdx}`;
  }
}

class Game {
  day: number;
  nutrients: number;
  cells: Cell[];
  possibleActions: Action[];
  trees: Tree[];
  myTreesBySize: [number, number, number, number];
  mySun: number;
  myScore: number;
  opponentSun: number;
  opponentScore: number;
  opponentIsWaiting: boolean;
  maxReachableRichness: number;
  completeDone: number;
  seedableFallback: boolean;
  DAYS: number = 23;
  MIN_LEVEL2_BEFORE_LEVEL3 = 4;
  COMPLETE_MIN_DAY = 14;
  MIN_LEVEL3_TO_START_COMPLETE = 5;
  MAX_COMPLETE_PER_DAY = 1;
  MAX_SEED = 1;
  ALLOW_SEEDABLE_FALLBACK = true;
  constructor() {
    this.day = 0;
    this.nutrients = 0;
    this.cells = [];
    this.trees = [];
    this.myTreesBySize = [0, 0, 0, 0];
    this.mySun = 0;
    this.myScore = 0;
    this.opponentSun = 0;
    this.opponentScore = 0;
    this.opponentIsWaiting = false;
    this.maxReachableRichness = 0;
    this.completeDone = 0;
  }

  // Called 1 time after filling all cells
  fillCellRelations() {
    // neighbors > neighborCells
    game.cells.forEach(cell => {
      cell.neighbors.forEach(neighbor => {
        cell.neighborCells.push(game.cells[neighbor]);
      });
    });
    // Liste des cellules à une distance de 1, 2, 3
    game.cells.forEach(originCell => {
      let cellsFrom = [originCell];
      for (let i = 1; i <= 3; i++) {
        const cellsTarget: Set<Cell> = new Set();
        for (let j = 0, max = cellsFrom.length; j < max; j++) {
          cellsFrom[j].neighborCells
            .filter(cell => Boolean(cell))
            .forEach(item => cellsTarget.add(item));
        }
        cellsFrom = [...cellsTarget];
        for (let j = 1; j < i; j++) {
          // Pour les distances 2 et 3, ajouter les niveaux précédents
          originCell.relations[j].forEach((item: Cell) => cellsTarget.add(item));
        }
        originCell.relations[i].push(...cellsTarget);
        originCell.relations[i].sort(
          (prevCell: Cell, nextCell: Cell) => prevCell.index - nextCell.index,
        );
      }
    });
    // Liste des cellules dans l'ombre à une distance de 1, 2, 3
    game.cells.forEach(originCell => {
      originCell.neighborCells.forEach((cell, index) => {
        if (!cell) return;
        originCell.shadow[1].push(cell);
        originCell.shadow[2].push(cell);
        originCell.shadow[3].push(cell);
        if (!cell.neighborCells[index]) return;
        originCell.shadow[2].push(cell.neighborCells[index]);
        originCell.shadow[3].push(cell.neighborCells[index]);
        if (!cell.neighborCells[index].neighborCells[index]) return;
        originCell.shadow[3].push(cell.neighborCells[index].neighborCells[index]);
      });
    });
  }
  // Called 1 time at begin of each turn
  newTurn(day: number) {
    if (day !== this.day) this.completeDone = 0;
    this.day = day;
    this.maxReachableRichness = 0;
    this.trees = [];
    this.myTreesBySize.fill(0);
    this.seedableFallback = this.ALLOW_SEEDABLE_FALLBACK;
    this.cells.forEach(cell => {
      cell.available = cell.richness !== 0;
      cell.tree = null;
      cell.seedable = cell.available ? 2 : 0; // Le top par défaut, ca va réduire en ajoutant des arbres
    });
  }
  // Called each turn to fill the tree
  addTree(cellIndex: number, size: number, isMine: boolean, isDormant: boolean) {
    const treeCell = this.cells.find(cell => cell.index === cellIndex);
    const tree = new Tree(treeCell, size, isMine, isDormant);
    this.trees.push(tree);
    treeCell.available = false;
    treeCell.tree = tree;
    if (tree.isMine) this.myTreesBySize[tree.size]++;
  }
  /* 
        Called 1 time each turn after filling all trees
        Comptage des arbres ombrageables
        Mise a jour de la priorité de seed
        Fill tree.reachableCells
        Fill tree.maxReachableRichness
        Fill maxReachableRichness
    */
  afterAddTrees() {
    // Comptage des arbres ombrables
    this.trees.forEach(tree => {
      if (tree.size > 0) {
        tree.cell.shadow[tree.size].forEach((cell: Cell) => {
          if (!cell.tree) return;
          if (cell.tree.isMine && tree.size >= cell.tree.size) tree.shadowMine++;
          if (!cell.tree.isMine && tree.size >= cell.tree.size) tree.shadowOpponent++;
        });
      }
      if (tree.size < 3) {
        tree.cell.shadow[tree.size + 1].forEach((cell: Cell) => {
          if (!cell.tree) return;
          if (cell.tree.isMine && tree.size + 1 >= cell.tree.size) tree.growShadowMine++;
          if (!cell.tree.isMine && tree.size + 1 >= cell.tree.size) tree.growShadowOpponent++;
        });
      }
    });

    // Mise a jour de la priorité de seed
    this.trees.forEach(tree => {
      tree.cell.seedable = 0;
      if (!tree.isMine) return;
      tree.cell.neighborCells.filter(cell => Boolean(cell)).forEach(cell => (cell.seedable = 0));
      tree.cell.shadow[2].forEach(cell => {
        if (cell.seedable === 2) cell.seedable = 1;
      });
    });
    this.seedableFallback =
      this.ALLOW_SEEDABLE_FALLBACK && !this.cells.find(cell => cell.seedable === 2);

    // Recherche cellules atteignables pour le SEED
    this.trees.forEach(tree => {
      if (tree.size > 1) {
        tree.reachableCells = tree.cell.relations[tree.size].filter(
          (cell: Cell) => cell.available && cell.seedable > 0,
        );
        // Mise à jour de la meilleur qualité atteignable pour l'arbre
        tree.maxReachableRichness =
          tree.reachableCells.length > 0
            ? tree.reachableCells.reduce((acc, cell) => {
                if (!cell) console.error(tree.reachableCells);
                if (tree.isMine && cell.seedable === 1) return acc; // On ignore les seedable 1 pour le maxrichness de l'arbre
                if (cell.richness > acc) return cell.richness;
                return acc;
              }, 0)
            : 0;

        // Mise à jour de la meilleur qualité atteignable par moi
        if (tree.isMine && tree.maxReachableRichness > this.maxReachableRichness) {
          this.maxReachableRichness = tree.maxReachableRichness;
        }
      }
      // Mise à jour de la meilleur qualité atteignable par l'arbre apres grow
      if (tree.size < 3 && tree.maxReachableRichness < 3) {
        const growReachableCells = tree.cell.relations[tree.size + 1].filter(
          (cell: Cell) => cell.available && cell.seedable > 0,
        );
        tree.growRichness =
          growReachableCells.length > 0
            ? growReachableCells.reduce((acc: number, cell: Cell) => {
                if (!cell) console.error(tree.reachableCells);
                if (tree.isMine && cell.seedable === 1) return acc; // On ignore les seedable 1 pour le maxrichness de l'arbre
                if (cell.richness > acc) return cell.richness;
                return acc;
              }, 0)
            : 0;
      }
    });

    this.addSunToCells();
    console.error('maxRichness:', this.maxReachableRichness);
  }

  addSunToCells() {
    this.cells.forEach(cell => {
      cell.calculatedSun = 0;
      if (cell.tree && !cell.tree.isMine) return;
      if (cell.richness === 0) return;
      // SEED
      if (!cell.tree) {
        const tree = new Tree(cell, 3, true, false);
        cell.calculatedSun = this.calcSun6([...this.trees, tree]);
      }
      // COMPLETE
      if (cell.tree && cell.tree.isMine && cell.tree.size === 3) {
        cell.calculatedSun = this.calcSun6(
          this.trees.filter(tree => tree.cell.index !== cell.index),
        );
      }
      // GROW
      if (cell.tree && cell.tree.isMine && cell.tree.size !== 3) {
        const tree = new Tree(cell, cell.tree.size + 1, true, false);
        cell.calculatedSun = this.calcSun6([
          ...this.trees.filter(tree => tree.cell.index !== cell.index),
          tree,
        ]);
      }
    });
  }

  calcSun6(trees: Tree[]): number {
    let sun = 0;
    for (let ombre = 0; ombre < 6; ombre++) {
      sun += this.calcSun(trees, ombre);
    }
    return sun;
  }

  calcSun(trees: Tree[], ombre: number): number {
    const ombreCellIndex = [];
    trees.forEach((tree: Tree) => {
      let cell = tree.cell;
      for (let i = 1; i <= tree.size; i++) {
        cell = cell.neighborCells[ombre];
        if (!cell) return;
        ombreCellIndex.push({ size: tree.size, index: cell.index });
      }
    });

    let sun = 0;
    trees.forEach((tree: Tree) => {
      if (ombreCellIndex.find(oci => oci.index === tree.cell.index && oci.size >= tree.size))
        return;
      if (tree.isMine) {
        sun += tree.size;
      } else {
        sun -= tree.size;
      }
    });
    return sun;
  }

  // Retourne mes arbres de taille 3 trié par richness décroissante
  getCompletableTrees(): Tree[] {
    return this.trees
      .filter(tree => tree.isMine && tree.size === 3 && !tree.isDormant)
      .sort((prevTree, nextTree) => nextTree.cell.richness - prevTree.cell.richness);
  }
  // Retourne mes arbres de taille indiquée (0 a 2 en général)
  getGrowableTrees(size: number[]): Tree[] {
    return this.trees.filter(tree => tree.isMine && !tree.isDormant && size.includes(tree.size));
  }
  // Retourne mes arbres disponibles de taille 2 ou 3, trié par richness atteignable décroissante
  getSeedableTrees(): Tree[] {
    return this.trees
      .filter(tree => tree.isMine && !tree.isDormant && tree.size >= 2)
      .sort((prevTree, nextTree) => nextTree.maxReachableRichness - prevTree.maxReachableRichness);
  }
  costOfGrow(treeSize: number): number {
    const countSameTrees = this.myTreesBySize[treeSize + 1];
    if (treeSize === 0) {
      return 1 + countSameTrees;
    } else if (treeSize === 1) {
      return 3 + countSameTrees;
    } else if (treeSize === 2) {
      return 7 + countSameTrees;
    } else {
      console.error('cannot upgrade tree size 3');
      return 9999; // ne doit pas arriver
    }
  }
  costOfSeed(): number {
    return this.myTreesBySize[0];
  }

  searchSeedsFromTree(seedableTree: Tree): { cell: Cell; tree: Tree }[] {
    const allSeeds = seedableTree.reachableCells.filter(
      cell => cell.seedable === 2 || (this.seedableFallback && cell.seedable === 1),
    ); // Bcp moins de points si je prend 1 et 2
    if (allSeeds.length === 0) return [];
    return allSeeds.map(cell => ({ cell, tree: seedableTree }));
  }

  // Algo de détermination de l'action SEED
  canWeSeed(): Action {
    const costOfSeed = this.costOfSeed();
    if (this.mySun < costOfSeed) return null;

    const currentSeedsNumber = this.myTreesBySize[0];

    // Pas de seed les 4 derniers jours car on ne pourra complete !
    // sauf si c'est gratuit
    if (this.DAYS - this.day < 5 && costOfSeed !== 0) return null;

    // Pas de seed si on en a déja le nombre max
    if (currentSeedsNumber >= this.MAX_SEED) return null;

    // Liste des abres dispo pour seed
    const seedableTrees = this.getSeedableTrees();
    if (seedableTrees.length === 0) {
      return null;
    }

    // Liste des cells accessibles pour ces arbres
    const seeds: { cell: Cell; tree: Tree }[] = [];
    for (let i = 0; i < seedableTrees.length; i++) {
      const seedableTree = seedableTrees[i];
      seeds.push(...this.searchSeedsFromTree(seedableTree));
    }
    if (seeds.length === 0) return null;

    // Tri des seeds par richness de target décroissante puis :
    // les arbres de taille 3 sont préférés pour seed
    // TODO : choisir la meilleur cell target parmis les meilleur richness
    // TODO : choisir le meilleur arbre (le moins bon completable pour les taille 3, le moins bon growable pour les tailles 2)
    seeds.sort((prevSeed, nextSeed) => {
      if (prevSeed.cell.richness > nextSeed.cell.richness) return -1;
      if (prevSeed.cell.richness < nextSeed.cell.richness) return 1;

      if (prevSeed.cell.seedable > nextSeed.cell.seedable) return -1;
      if (prevSeed.cell.seedable < nextSeed.cell.seedable) return 1;

      return nextSeed.cell.calculatedSun - prevSeed.cell.calculatedSun;
      return nextSeed.tree.size - prevSeed.tree.size;
    });
    //console.error('Seedables', seeds)

    return new Action(ActionType.SEED, seeds[0].cell.index, seeds[0].tree.cell.index);
  }
  // Algo de détermination de l'action GROW
  canWeGrow(): Action {
    let growableTreeSize = [];
    // On liste les tailles d'arbre qu'on a assez d'argent pour GROW
    // Mais on limite à ce qui pourra etre COMPLETE avant la fin du jeu
    for (let i = Math.max(0, 3 - this.DAYS + this.day); i < 3; i++) {
      const cost = this.costOfGrow(i);
      if (this.mySun >= cost) {
        growableTreeSize.push(i);
      }
    }

    if (growableTreeSize.length === 0) return null;

    let growableTrees = this.getGrowableTrees(growableTreeSize);

    growableTrees.sort((prevTree, nextTree) => {
      // En début de partie, on favorise le grow qui nous permet d'atteindre les cells de richness 3
      if (
        this.maxReachableRichness !== 3 &&
        nextTree.growRichness === 3 &&
        prevTree.growRichness !== 3
      )
        return 1;
      if (
        this.maxReachableRichness !== 3 &&
        nextTree.growRichness !== 3 &&
        prevTree.growRichness === 3
      )
        return -1;

      // TODO : c'est pas bon ca. Ca me freine trop
      // Ensuite on favorise le grow qui va gêner le + l'adversaire et le moins nous
      //if ( (prevTree.growShadowOpponent - prevTree.shadowOpponent - prevTree.growShadowMine + prevTree.shadowMine) > (nextTree.growShadowOpponent - nextTree.shadowOpponent - nextTree.growShadowMine + nextTree.shadowMine) ) return -1;
      //if ( (prevTree.growShadowOpponent - prevTree.shadowOpponent - prevTree.growShadowMine + prevTree.shadowMine) < (nextTree.growShadowOpponent - nextTree.shadowOpponent - nextTree.growShadowMine + nextTree.shadowMine) ) return 1;

      return nextTree.cell.calculatedSun - prevTree.cell.calculatedSun;

      // Ensuite on favorise les gros arbres
      if (nextTree.size > prevTree.size) return 1;
      if (nextTree.size < prevTree.size) return -1;

      // Enfin on favorise les cell les + riches
      return nextTree.cell.richness - prevTree.cell.richness;
    });

    if (growableTrees.length === 0) {
      return null;
    }
    if (
      this.COMPLETE_MIN_DAY > this.day &&
      this.myTreesBySize[2] < this.MIN_LEVEL2_BEFORE_LEVEL3 &&
      growableTrees[growableTrees.length - 1].size !== 2
    )
      growableTrees = growableTrees.filter(tree => tree.size !== 2);

    return new Action(ActionType.GROW, growableTrees[0].cell.index);
  }

  canWeComplete(): Action {
    if (this.mySun < 4) return null;
    if (
      this.day < this.COMPLETE_MIN_DAY &&
      this.MIN_LEVEL3_TO_START_COMPLETE > this.myTreesBySize[3]
    )
      return null;
    if (this.completeDone >= this.MAX_COMPLETE_PER_DAY && this.day !== this.DAYS) return null;
    console.error(
      'COMPLETE CHECK',
      this.day,
      this.COMPLETE_MIN_DAY,
      this.MIN_LEVEL3_TO_START_COMPLETE,
      this.myTreesBySize[3],
    );
    const completableTrees = this.getCompletableTrees();
    if (completableTrees.length === 0) return null;

    // En fin de partie, s'il ne reste que 1 ou 0 nutrients, ne pas complete un arbre a +0, ca vaut au moins autant de garder les soleils
    if (this.nutrients <= 1 && completableTrees[0].cell.richness === 1) return null;

    const topTrees = completableTrees
      .filter(tree => tree.cell.richness === completableTrees[0].cell.richness)
      .sort((prevTree, nextTree) => {
        // Tri croissant par différence entre les arbres ennemi ombré - mes arbres ombrés pour complete l'arbre qui me gene le +
        return prevTree.cell.calculatedSun - nextTree.cell.calculatedSun;
        return (
          prevTree.shadowOpponent -
          prevTree.shadowMine -
          (nextTree.shadowOpponent - nextTree.shadowMine)
        );
      });
    if (topTrees.length > 0) {
      return new Action(ActionType.COMPLETE, topTrees[0].cell.index);
    } else {
      return null;
    }
  }
  needEmergencyComplete(): boolean {
    const completableTrees = this.getCompletableTrees();
    const daysLeft = this.DAYS - this.day;
    return daysLeft <= completableTrees.length;
  }

  getNextAction(): Action {
    // Planter une graine
    const seedAction = this.canWeSeed();

    // Arbre a upgrader
    const growAction = this.canWeGrow();

    // Abre a completer
    const completeAction = this.canWeComplete();

    // emergency complete ?
    const emergencyComplete = this.needEmergencyComplete(); // TODO : a afiner
    console.error(emergencyComplete, seedAction, growAction, completeAction);

    // TODO améliorer la fin de partie en réservant les points nécessaire au finish du dernier tour
    // TODO voir si c'est pas plus rentable de complete un arbre quand on commence a en avoir beaucoup si il fait beaucoup d'ombre a mes arbres
    for (let i = 3; i >= 0; i--) {
      if (completeAction) {
        this.completeDone++;
        return completeAction;
      }
      if (this.maxReachableRichness !== 3 && growAction) return growAction;
      if (growAction && this.cells[growAction.targetCellIdx].richness === i) return growAction;
      if (seedAction && this.cells[seedAction.targetCellIdx].richness === i) return seedAction;
      //if (!emergencyComplete && completeAction && this.cells[completeAction.targetCellIdx].richness === i) return completeAction;
    }

    return new Action(ActionType.WAIT);
  }
}

const game = new Game();

const numberOfCells = Number(readline());
for (let i = 0; i < numberOfCells; i++) {
  const cell: number[] = readline().split(' ').map(Number);
  game.cells.push(
    new Cell(cell[0], cell[1], [cell[2], cell[3], cell[4], cell[5], cell[6], cell[7]]),
  );
}
game.cells.sort((prev, next) => prev.index - next.index); // Juste pour etre sur...
game.fillCellRelations();

while (true) {
  game.newTurn(Number(readline()));
  game.nutrients = Number(readline());
  [game.mySun, game.myScore] = readline().split(' ').map(Number);
  const opponentInfos: number[] = readline().split(' ').map(Number);
  game.opponentSun = opponentInfos[0];
  game.opponentScore = opponentInfos[1];
  game.opponentIsWaiting = opponentInfos[2] !== 0;
  const numberOfTrees = Number(readline());
  for (let i = 0; i < numberOfTrees; i++) {
    const tree: string[] = readline().split(' ');
    game.addTree(Number(tree[0]), Number(tree[1]), tree[2] !== '0', tree[3] !== '0');
  }
  game.afterAddTrees();

  // Useless var
  const numberOfPossibleAction = Number(readline());
  for (let i = 0; i < numberOfPossibleAction; i++) {
    const possibleAction: string = readline();
  }

  console.error(game.cells.map(cell => ({ index: cell.index, sun: cell.calculatedSun })));
  const action = game.getNextAction();
  console.log(action.toString());
}
