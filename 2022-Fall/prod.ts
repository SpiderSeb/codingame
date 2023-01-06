/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-param-reassign */
/* eslint-disable no-use-before-define */
/* eslint-disable max-classes-per-file */

// eslint-disable-next-line import/no-unresolved
import { readline } from "..";

// Copy/paste from here

class Performance {
  times: number[];

  constructor() {
    this.times = [new Date().getTime()];
  }

  getTime(log = "") {
    this.times.push(new Date().getTime());
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const time = this.times.at(-1)! - this.times.at(-2)!;
    if (log) {
      console.error(`${log}: ${time}ms`);
    }
    return time;
  }

  getTotalTime(log = "") {
    this.times.push(new Date().getTime());
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const totalTime = this.times.at(-1)! - this.times.at(0)!;
    if (log) {
      console.error(`${log}: ${totalTime}ms`);
    }
    return totalTime;
  }
}

type Position = [number, number];
type CellProps = {
  scrapAmount: number;
  owner: number;
  units: number;
  recycler: number;
  canBuild: number;
  canSpawn: number;
  inRangeOfRecycler: number;
};
class Cell {
  scrapAmount = 0;

  owner = -1;

  units = 0;

  recycler = false;

  canBuild = false;

  canSpawn = false;

  inRangeOfRecycler = false;

  // Scrap amount when recycler will be destroyed
  finalScrapAmount = 0;

  // Unit planed to move in this cell this turn
  addedUnits = 0;

  // Unit planed to move out this cell this turn
  removedUnits = 0;

  // ONLY FROM MY CELLS and neighbor: all accessibles cell, by distance
  private distances: Record<number, Cell[]> = {};

  // ONLY FROM MY CELLS and neighbor: distance of each cell
  private cellDistances: Map<Cell, number> = new Map();

  // 4 neighbor cells
  neighbors: Cell[] = [];

  // Any neutral neighbor cell ?
  neighborToNeutral = false;

  // Any enemy neighbor cell ?
  neighborToEnemy = false;

  // Any me neighbor cell ?
  neighborToMe = false;

  neighborEnemyUnits = 0;

  neighborAllyUnits = 0;

  island?: Island;

  // material got if recycler is placed here
  recyclerValue = 0;

  // Number of me/neutral cell lost if recycler built here
  cellLostIfRecyclerBuilt = 5;

  isRushed = false;

  // eslint-disable-next-line no-useless-constructor
  constructor(readonly position: Position, readonly game: Game) {}

  updateCellData({
    scrapAmount,
    owner,
    units,
    recycler,
    canBuild,
    canSpawn,
    inRangeOfRecycler,
  }: CellProps) {
    this.scrapAmount = scrapAmount;
    this.owner = owner;
    this.units = units;
    this.recycler = recycler === 1;
    this.canBuild = canBuild === 1;
    this.canSpawn = canSpawn === 1;
    this.inRangeOfRecycler = inRangeOfRecycler === 1;
    this.finalScrapAmount = this.recycler ? 0 : scrapAmount;
    this.addedUnits = 0;
    this.removedUnits = 0;
    this.distances = {};
    this.cellDistances = new Map();
    this.island = undefined;
    this.isRushed = false;
  }

  setIsland(island: Island) {
    this.island = island;
  }

  planBuild() {
    this.canSpawn = false;
    this.inRangeOfRecycler = true;
    this.recycler = true;
    this.canBuild = false;
    this.updateFinalScrapAmount();
    this.updateRecyclerTarget();
    this.neighbors.forEach((cell) => {
      cell.inRangeOfRecycler = true;
      cell.updateFinalScrapAmount();
      cell.updateRecyclerTarget();
    });
  }

  setDistances(distance: number, cellsToSet: Cell[]) {
    this.distances[distance] = cellsToSet;
    cellsToSet.forEach((cell) => this.cellDistances.set(cell, distance));
  }

  updateNeighbors(cells = this.neighbors) {
    this.neighbors = cells.filter((cell) => cell.scrapAmount);
    this.neighborToEnemy = this.neighbors.some(
      (cell) => cell.owner === 0 && !cell.recycler
    );
    this.neighborToMe = this.neighbors.some(
      (cell) => cell.owner === 1 && !cell.recycler
    );
    this.neighborToNeutral = this.neighbors.some((cell) => cell.owner === -1);

    this.neighborEnemyUnits = this.neighborToEnemy
      ? this.neighbors.reduce(
          (units, cell) => units + (cell.owner === 0 ? cell.units : 0),
          0
        )
      : 0;

    this.neighborAllyUnits = this.neighborToMe
      ? this.neighbors.reduce(
          (units, cell) => units + (cell.owner === 1 ? cell.units : 0),
          0
        )
      : 0;

    this.updateFinalScrapAmount();

    this.updateRecyclerTarget();
  }

  updateRecyclerTarget() {
    // TODO calculer la valeur sans tenir compte des recyclers enemy
    this.recyclerValue =
      this.finalScrapAmount +
      this.neighbors.reduce(
        (acc, neighbor) =>
          acc + Math.min(neighbor.finalScrapAmount, this.scrapAmount),
        0
      );

    this.cellLostIfRecyclerBuilt = this.neighbors.reduce(
      (acc, cell) => {
        if (
          cell.finalScrapAmount &&
          cell.owner !== 0 &&
          cell.scrapAmount <= this.scrapAmount
        )
          return acc + 1;
        return acc;
      },
      this.finalScrapAmount > 0 ? 1 : 0
    );
  }

  updateFinalScrapAmount() {
    if (this.recycler) {
      this.finalScrapAmount = 0;
    } else if (!this.inRangeOfRecycler) {
      this.finalScrapAmount = this.scrapAmount;
    } else {
      const neighborRecyclers = this.neighbors.filter(
        (neighborCell) => neighborCell.recycler
      );
      const maxNeighborRecyclersScrap = neighborRecyclers.reduce(
        (acc, current) =>
          current.scrapAmount > acc ? current.scrapAmount : acc,
        0
      );
      this.finalScrapAmount = Math.max(
        this.scrapAmount - maxNeighborRecyclersScrap,
        0
      );
    }
  }

  isNeighbor(cell: Cell): boolean {
    return this.neighbors.includes(cell);
  }

  addUnits(quantity: number) {
    this.addedUnits += quantity;
  }

  removeUnits(quantity: number) {
    this.removedUnits += quantity;
  }

  getDistanceTo(targetCell: Cell): number | undefined {
    if (this.owner !== 1 && !this.neighborToMe) {
      console.error("==> ERROR ! Try to get distance from a not owned cell");
    }
    return this.cellDistances.get(targetCell);
  }

  getDistanceToEnemy(): number {
    if (this.owner !== 1 && !this.neighborToMe) {
      console.error("==> ERROR ! Try to get distance from a not owned cell");
    }
    let distance = 1;
    while (this.distances[distance]) {
      const found = this.distances[distance].some(
        (cell) => cell.owner === 0 && !cell.recycler
      );
      if (found) return distance;
      distance++;
    }
    return Infinity;
  }

  getClosestFreeAlly(): Cell | undefined {
    let distance = 1;
    while (this.distances[distance]) {
      const target = this.distances[distance].filter(
        (cell) =>
          cell.owner === 1 &&
          cell.units > cell.removedUnits &&
          cell.units - cell.removedUnits + cell.addedUnits >
            cell.neighborEnemyUnits &&
          ((this.game.me.initialPosition![0] >
            this.game.enemy.initialPosition![0] &&
            cell.position[0] > this.position[0]) ||
            (this.game.me.initialPosition![0] <
              this.game.enemy.initialPosition![0] &&
              cell.position[0] < this.position[0]))
      );
      // TODO sort

      if (target.length) return target[0];
      distance++;
    }
    return undefined;
  }

  getClosestExpandCell(maxAddedUnits = 0): Cell | undefined {
    if (this.owner !== 1 && !this.neighborToMe) {
      console.error("==> ERROR ! Try to get distance from a not owned cell");
    }
    let distance = 1;
    while (this.distances[distance]) {
      const target = this.distances[distance].filter(
        (cell) =>
          cell.owner !== 1 && cell.addedUnits <= maxAddedUnits && !cell.recycler
      ); // TODO se méfier des grosses unités enemi
      target.sort((a, b) => {
        // 1st priority : enemy cell
        if (a.owner === 0 && b.owner === 0) return a.units - b.units; // If both enemy, choose the one with less units
        if (a.owner === 0 && b.owner !== 0) return -1;
        if (b.owner === 0 && a.owner !== 0) return 1;
        // 2nd priority : neutral closer to enemy border
        const aDistanceFromEnemyBorderX = Math.abs(
          this.game.me.targetBorderX - a.position[0]
        );
        const bDistanceFromEnemyBorderX = Math.abs(
          this.game.me.targetBorderX - b.position[0]
        );
        if (aDistanceFromEnemyBorderX !== bDistanceFromEnemyBorderX)
          return aDistanceFromEnemyBorderX - bDistanceFromEnemyBorderX;

        // 3nd priority : neutral closer to vertical center
        const aDistanceFromCenterY = Math.abs(
          (a.game.height - 1) / 2 - a.position[1]
        );
        const bDistanceFromCenterY = Math.abs(
          (b.game.height - 1) / 2 - b.position[1]
        );
        if (aDistanceFromCenterY !== bDistanceFromCenterY)
          return aDistanceFromCenterY - bDistanceFromCenterY;

        return 0;
      });
      if (target.length) return target[0];
      distance++;
    }
    return undefined;
  }
}

class Island {
  cells: Cell[] = [];

  owner?: "me" | "contest" | "enemy" | "nobody";

  fullOwned = false;

  // Cells of the island after all recyclers have been destroyed
  finalSlots = 0;

  // Sum of units in the island (for owner me or enemy only)
  units = 0;

  addCell(cell: Cell) {
    this.cells.push(cell);
  }

  compute() {
    // Find owner (exclude recyclers)
    const owners = new Set(
      this.cells
        .filter((cell) => cell.owner !== -1 && !cell.recycler)
        .map((cell) => cell.owner)
    );
    if (owners.size === 0) {
      this.owner = "nobody";
    } else if (owners.size === 1) {
      this.owner = owners.has(1) ? "me" : "enemy";
      this.fullOwned = !this.cells.some((cell) => cell.owner === -1);
      this.units = this.cells.reduce((acc, cell) => acc + cell.units, 0);
    } else {
      this.owner = "contest";
    }

    // Compute cell distance (FROM MY CELLS, neighbor & rushcell ONLY: perf...)
    this.cells
      .filter(
        (cell) =>
          cell.owner === 1 ||
          cell.neighborToMe ||
          cell.game.rushCells.includes(cell)
      )
      .forEach((origin) => {
        const done = [origin];
        let distance = 1;
        let currentCells = [origin];
        while (currentCells.length) {
          const nextCells: Cell[] = [];
          currentCells.forEach((currentCell) => {
            currentCell.neighbors.forEach((neighborCell) => {
              if (
                !neighborCell.recycler &&
                !nextCells.includes(neighborCell) &&
                !done.includes(neighborCell)
              ) {
                nextCells.push(neighborCell);
              }
            });
          });
          if (nextCells.length) origin.setDistances(distance, nextCells);
          currentCells = nextCells;
          done.push(...nextCells);
          distance++;
        }
      });

    // compute cells alive at end of game
    this.finalSlots = this.cells.filter((cell) => cell.finalScrapAmount).length;
  }
}

class Player {
  // Available materials
  mater = 0;

  // All cells with unit
  units: Cell[] = [];

  // Initial center position
  initialPosition?: Position;

  // X posistion to target when moving to neutral
  targetBorderX = 0;

  score = 0;

  // eslint-disable-next-line no-useless-constructor
  constructor(private readonly game: Game) {}

  newTurn() {
    this.units = [];
  }

  updateScore(score: number) {
    this.score = score;
  }

  // Must be called during first turn, after cell initialization
  setInitialPosition() {
    if (!this.initialPosition) {
      this.initialPosition = [
        this.units.reduce((acc, cell) => acc + cell.position[0], 0) /
          this.units.length,
        this.units.reduce((acc, cell) => acc + cell.position[1], 0) /
          this.units.length,
      ];
      if (this.initialPosition[0] < this.game.width / 2)
        this.targetBorderX = this.game.width - 1;
    }
  }

  setMater(value: number) {
    this.mater = value;
  }

  decreaseMater(value: number) {
    this.mater -= value;
  }

  addUnit(cell: Cell) {
    this.units.push(cell);
  }
}

type IndividualAction =
  | {
      type: "wait";
    }
  | {
      type: "move";
      cellFrom: Cell;
      cellTo: Cell;
      quantity: number;
    }
  | {
      type: "build";
      cellTo: Cell;
    }
  | {
      type: "spawn";
      cellTo: Cell;
      quantity: number;
    }
  | {
      type: "message";
      message: string;
    };
class Action {
  // List of actions planed for the current turn
  actions: IndividualAction[] = [];

  tauntSentence = "";

  // eslint-disable-next-line no-useless-constructor
  constructor(private readonly game: Game) {}

  newTurn() {
    this.actions = [];
  }

  printActions() {
    if (!this.actions.length) {
      // Avoid loosing with no action
      this.wait();
    }
    this.taunt();
    return this.actions.map((action) => this.print(action));
  }

  // eslint-disable-next-line class-methods-use-this
  print(action: IndividualAction): string {
    switch (action.type) {
      case "wait":
        return `WAIT`;
      case "move":
        return `MOVE ${action.quantity} ${action.cellFrom.position[0]} ${action.cellFrom.position[1]} ${action.cellTo.position[0]} ${action.cellTo.position[1]}`;
      case "spawn":
        return `SPAWN ${action.quantity} ${action.cellTo.position[0]} ${action.cellTo.position[1]}`;
      case "build":
        return `BUILD ${action.cellTo.position[0]} ${action.cellTo.position[1]}`;
      case "message":
        return `MESSAGE ${action.message}`;
      default:
        throw new Error(`unknown action type`);
    }
  }

  taunt() {
    const starting = [
      "go go go",
      "Onward, my bots",
      "on the road again...",
      "ready to loose, my friend ?",
      "powered by chatGCP",
    ];
    const wining = [
      "easy game",
      "your AI looks buggy",
      "too slow",
      "oh please, start to play",
      "same AI than last year?",
      "spawn more bots",
      "spawn less bots",
      "build more recyclers",
      "build less recyclers",
      "I will use your AI... or not !",
    ];
    const loosing = [
      "that was not the plan",
      "I admit, it's not bad",
      "well played",
      "there is a bug, I should win",
      "ballot box stuffing!",
      "wait! where do these robots come from?",
      "I will ask for a recount",
      "You have a great AI",
      "Impressive!",
      "Awesome!",
      "I love your AI",
    ];
    if (this.game.turn % 3 === 1) {
      if (this.game.turn < 10) {
        this.tauntSentence =
          starting[Math.floor(Math.random() * starting.length)];
      } else if (
        this.game.turn > 190 ||
        this.game.noChange > 10 ||
        !this.game.islands.some((island) => island.owner === "contest")
      ) {
        this.tauntSentence = "Thank you 😊";
      } else if (this.game.me.score >= this.game.enemy.score) {
        this.tauntSentence = wining[Math.floor(Math.random() * wining.length)];
      } else {
        this.tauntSentence =
          loosing[Math.floor(Math.random() * loosing.length)];
      }
    }
    this.actions.push({
      type: "message",
      message: this.tauntSentence,
    });
  }

  message(message: string) {
    this.actions.push({ type: "message", message });
  }

  wait() {
    this.actions.push({ type: "wait" });
  }

  move(quantity: number, cellFrom: Cell, cellTo: Cell) {
    if (!cellFrom || !cellTo) {
      console.error("==>> Invalid move !!!", cellFrom, cellTo, quantity);
      return;
    }
    if (cellFrom.neighbors.includes(cellTo)) {
      cellFrom.removeUnits(quantity);
      cellTo.addUnits(quantity);
      this.actions.push({ type: "move", cellFrom, cellTo, quantity });
      return;
    }
    // Target is not a neibhbor, find the best neighbor to go to target
    const baseTargets = cellFrom.neighbors.filter(
      (cell) =>
        !cell.recycler && (!cell.inRangeOfRecycler || cell.scrapAmount > 1)
    );
    if (baseTargets.length === 0) {
      console.error(
        "==>> Invalid move: no way out",
        cellFrom.position,
        cellTo.position,
        quantity
      );
      cellFrom.removeUnits(quantity);
      return;
    }

    const minDistance = Math.min(
      ...baseTargets.map((cell) => cell.getDistanceTo(cellTo) || Infinity)
    );
    const targetCells = baseTargets
      .filter((cell) => cell.getDistanceTo(cellTo) === minDistance)
      .sort((a, b) => {
        // target sans unit prio
        if (a.units !== b.units) return a.units - b.units;

        // target enemi prio puis neutral
        if (a.owner !== b.owner) {
          if (a.owner === 0) return -1;
          if (b.owner === 0) return 1;
          if (a.owner === -1) return -1;
          if (b.owner === -1) return 1;
        }

        return 0;
      });
    if (targetCells.length === 0) {
      console.error(
        "==>> Invalid move: no way found",
        cellFrom.position,
        cellTo.position,
        quantity
      );
      cellFrom.removeUnits(quantity);
      return;
    }

    cellFrom.removeUnits(quantity);
    targetCells[0].addUnits(quantity);
    this.actions.push({
      type: "move",
      cellFrom,
      cellTo: targetCells[0],
      quantity,
    });
    console.error(
      `=> Redirect unit ${cellFrom.position} move from ${cellTo.position} to ${targetCells[0].position}`
    );
  }

  spawn(quantity: number, cellTo: Cell) {
    if (!cellTo) {
      console.error("==>> Invalid spawn !!!", cellTo, quantity);
      return;
    }
    this.game.me.decreaseMater(10 * quantity);
    cellTo.addUnits(quantity);
    this.actions.push({ type: "spawn", quantity, cellTo });
  }

  build(cellTo: Cell) {
    if (!cellTo) {
      console.error("==>> Invalid build !!!", cellTo);
      return;
    }
    this.game.me.decreaseMater(10);
    cellTo.planBuild();
    this.actions.push({ type: "build", cellTo });
  }
}

class Game {
  turn = 0;

  me: Player;

  enemy: Player;

  action: Action;

  // All game cells
  cells: Cell[] = [];

  // Cells grouped by island
  islands: Island[] = [];

  // Points that can be done on "me" islands
  garanteedPoints = 0;

  // Max number of points (all cells not destroyed)
  maxPoints = 0;

  // Number of turns without cell change
  noChange = 0;

  rushCells: Cell[] = [];

  constructor(readonly width: number, readonly height: number) {
    this.me = new Player(this);
    this.enemy = new Player(this);
    this.action = new Action(this);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.cells.push(new Cell([x, y], this));
      }
    }
  }

  newTurn(myMatter: number, oppMatter: number) {
    this.turn++;
    console.error("##### New Turn #####", this.turn);
    this.me.setMater(myMatter);
    this.enemy.setMater(oppMatter);
    this.islands = [];
    this.action.newTurn();
    this.me.newTurn();
    this.enemy.newTurn();
  }

  updateCell(position: Position, cellProps: CellProps) {
    const cell = this.findCellByPosition(position);
    if (!cell) {
      console.error("Cannot find cell at position", position);
      return;
    }
    cell.updateCellData(cellProps);

    if (cell.units) {
      if (cell.owner === 1) {
        this.me.addUnit(cell);
      } else {
        this.enemy.addUnit(cell);
      }
    }
  }

  findCellByPosition([x, y]: Position): Cell {
    return this.cells.find(
      (cell) => cell.position[0] === x && cell.position[1] === y
    ) as Cell; // Ne devrait pas pouvoir demander une position qui n'existe pas
  }

  updateScore() {
    const meScore = this.cells.reduce(
      (acc, cell) => acc + (cell.owner === 1 ? 1 : 0),
      0
    );
    const enemyScore = this.cells.reduce(
      (acc, cell) => acc + (cell.owner === 0 ? 1 : 0),
      0
    );

    if (this.me.score === meScore && this.enemy.score === enemyScore) {
      this.noChange++;
    } else {
      this.noChange = 0;
    }

    this.me.updateScore(meScore);
    this.enemy.updateScore(enemyScore);
  }

  updateRushCells() {
    if (this.turn === 1) {
      const rushX = Math.floor(
        this.me.initialPosition![0] < this.enemy.initialPosition![0]
          ? (this.width - 1) / 2
          : this.width / 2
      );

      this.cells.forEach((cell) => {
        if (cell.position[0] === rushX && !cell.recycler && cell.scrapAmount) {
          this.rushCells.push(cell);
        }
      });
      // Order cells by distance to initial Y
      this.rushCells.sort(
        (a, b) =>
          Math.abs(a.position[1] - this.me.initialPosition![1]) -
          Math.abs(b.position[1] - this.me.initialPosition![1])
      );
    } else {
      this.rushCells.forEach((cell, index) => {
        if (!cell.scrapAmount || cell.recycler || cell.owner !== -1)
          this.rushCells.splice(index, 1);
      });
    }

    console.error(`Rush line : ${this.rushCells.map((cell) => cell.position)}`);
  }

  compute() {
    const time = new Performance();
    // Set initial position
    if (this.turn === 1) {
      this.me.setInitialPosition();
      this.enemy.setInitialPosition();
    }

    // Update rush line
    this.updateRushCells();

    // Process neighbors
    if (this.turn === 1) {
      this.cells.forEach((origin) => {
        const neighbors = this.cells.filter(
          (target) =>
            (target.position[0] === origin.position[0] &&
              Math.abs(target.position[1] - origin.position[1]) === 1) ||
            (target.position[1] === origin.position[1] &&
              Math.abs(target.position[0] - origin.position[0]) === 1)
        );
        origin.updateNeighbors(neighbors);
      });
    } else {
      this.cells.forEach((cell) => cell.updateNeighbors());
    }

    // Build Island table
    const cells = this.cells.filter(
      (cell) => cell.scrapAmount && !cell.recycler
    );
    let currentCells: Cell[] = [];

    while (cells.length) {
      if (!currentCells.length) {
        this.islands.push(new Island());
        const cell = cells.shift() as Cell; // Cannot be undefined...
        currentCells.push(cell);
        this.islands[this.islands.length - 1].addCell(cell);
        cell.setIsland(this.islands[this.islands.length - 1]);
      }

      const nextCells: Cell[] = [];
      currentCells.forEach((currentCell) => {
        currentCell.neighbors.forEach((cell) => {
          if (cells.includes(cell) && !nextCells.includes(cell)) {
            nextCells.push(cell);
            this.islands[this.islands.length - 1].addCell(cell);
            cell.setIsland(this.islands[this.islands.length - 1]);
          }
        });
      });
      nextCells.forEach((cell) => {
        cells.splice(
          cells.findIndex((c) => c === cell),
          1
        );
      });
      currentCells = nextCells;
    }
    console.error("islands found:", this.islands.length);
    time.getTime("compute time build island");

    // For each island, compute (find owner & compute cell distances)
    this.islands.forEach((island) => island.compute());
    time.getTime("compute time compute island");

    // Count slots number of owned islands
    this.garanteedPoints = this.islands.reduce((acc, island) => {
      if (island.owner === "me") return acc + island.finalSlots;
      return acc;
    }, 0);

    // Count total slots
    this.maxPoints = this.islands.reduce((acc, island) => {
      if (island.owner !== "nobody") return acc + island.finalSlots;
      return acc;
    }, 0);
    time.getTime("compute time end general");

    // Update player scores
    this.updateScore();
    console.error("score:", this.me.score, this.enemy.score);

    // =====================================================

    // Build new recycler
    const enemyNearMe = this.cells.filter(
      (cell) =>
        cell.owner === 1 &&
        cell.neighborToEnemy &&
        !cell.units &&
        cell.canBuild &&
        cell.neighborEnemyUnits &&
        (cell.scrapAmount > 1 || !cell.inRangeOfRecycler)
    );
    if (enemyNearMe.length) {
      const overflowed = enemyNearMe.length > Math.floor(this.me.mater / 10);
      if (overflowed) {
        console.error("overflowed !!!");
        enemyNearMe.sort((a, b) => a.neighborAllyUnits - b.neighborAllyUnits);
      }
      enemyNearMe.forEach((cell) => {
        if (this.me.mater >= 10) {
          if (cell.neighborEnemyUnits > 1) {
            this.action.build(cell);
          } else {
            this.action.spawn(1, cell);
          }
        }
      });
    }
    if (this.turn % 1 === 0 && this.me.mater >= 10) {
      // TODO : attention a ne pas créer d'ile ou on a pas d'acces...
      // Build only on contest islands
      const contestsIslandCells = this.islands
        .filter((island) => island.owner === "contest")
        .reduce((acc: Cell[], current) => {
          acc.push(...current.cells);
          return acc;
        }, []);
      const preferedRecyclerTargets = contestsIslandCells
        .filter(
          (cell) =>
            cell.owner === 1 &&
            !cell.units &&
            cell.canBuild &&
            !cell.inRangeOfRecycler &&
            cell.cellLostIfRecyclerBuilt <= 1 &&
            cell.recyclerValue >= 12
        )
        .sort((a, b) => b.recyclerValue - a.recyclerValue); // Keep the one that will give maximum materials
      if (preferedRecyclerTargets.length) {
        this.action.build(preferedRecyclerTargets[0]);
        console.error(
          "build recycler bonus",
          preferedRecyclerTargets[0].position
        );
      }
    }
    time.getTime("compute time build recycler");

    // Move existing units
    /* this.rushCells.forEach((cell) => {
      const unit = cell.getClosestFreeAlly();
      if (unit) {
        this.action.move(1, unit, cell);
        cell.isRushed = true;
      }
    }); */

    this.me.units.forEach((unitCell) => {
      let maxUnits = 0;
      while (unitCell.units > unitCell.removedUnits) {
        const targetCell = unitCell.getClosestExpandCell(maxUnits);
        if (targetCell) {
          // Double check if a free unit is adjacent to target, take this unit instead of the initial unit
          const adjacentUnit = targetCell.neighbors.find(
            (neighbor) =>
              neighbor.units &&
              neighbor.owner === 1 &&
              neighbor.units - neighbor.removedUnits
          );
          if (adjacentUnit) {
            this.action.move(1, adjacentUnit, targetCell); // TODO 1 seule unit contre un ennemi ???
          } else {
            this.action.move(1, unitCell, targetCell); // TODO 1 seule unit contre un ennemi ???
          }
        } else if (maxUnits > 10) {
          break; // On sort du while
        } else {
          maxUnits++;
        }
      }
    });
    time.getTime("compute time move");

    // Spawn near rushable cell
    const spawnableCells = this.cells.filter(
      (cell) =>
        cell.owner === 1 &&
        cell.canSpawn &&
        (cell.scrapAmount > 1 || !cell.inRangeOfRecycler)
    );
    /* if (spawnableCells.length) {
      this.rushCells
        .filter((cell) => !cell.isRushed)
        .forEach((cell) => {
          if (this.me.mater < 10) return;
          spawnableCells.sort(
            (a, b) =>
              (a.getDistanceTo(cell) || 999) - (b.getDistanceTo(cell) || 999)
          );

          this.action.spawn(1, spawnableCells[0]);
          cell.isRushed = true;
        });
    } */

    // Spawn units near enemy cell
    for (let i = 0; i < 3; i++) {
      if (this.me.mater >= 10) {
        const closerToEnemyCell = spawnableCells
          .filter((cell) => cell.neighborToEnemy)
          .sort((a, b) => {
            return (
              a.units -
              a.removedUnits +
              a.addedUnits -
              b.units +
              b.removedUnits -
              b.addedUnits
            );
          });
        closerToEnemyCell.forEach((cell) => {
          if (this.me.mater >= 10) {
            this.action.spawn(1, cell);
          }
        });
      }
      time.getTime("compute time spawn near enemy");

      // Spawn units near neutral cell on contest islands closest to fight
      if (this.me.mater >= 10) {
        this.islands
          .filter((island) => island.owner === "contest")
          .sort((a, b) => b.cells.length - a.cells.length)
          .forEach((island) => {
            const closerToNeutralCell = island.cells
              .filter(
                (cell) =>
                  cell.owner === 1 &&
                  cell.neighborToNeutral &&
                  cell.canSpawn &&
                  (cell.scrapAmount > 1 || !cell.inRangeOfRecycler) &&
                  cell.island?.owner === "contest" &&
                  (this.turn < 12 || cell.getDistanceToEnemy() <= 3)
              )
              .sort((a, b) => {
                if (a.units === 0 && b.units !== 0) return -1;
                if (b.units === 0 && a.units !== 0) return 1;
                const aEnemyDist = a.getDistanceToEnemy();
                const bEnemyDist = b.getDistanceToEnemy();
                if (aEnemyDist !== bEnemyDist) return aEnemyDist - bEnemyDist;

                return (
                  a.units -
                  a.removedUnits +
                  a.addedUnits -
                  b.units +
                  b.removedUnits -
                  b.addedUnits
                );
              });
            closerToNeutralCell.forEach((cell) => {
              if (this.me.mater >= 10) {
                this.action.spawn(1, cell);
              }
            });
          });
      }
      // For "me" island, spawn 1 unit only if 0 unit is present on a non fully owned island
      if (this.me.mater >= 10) {
        const closerToNeutralCell = this.cells.filter(
          (cell) =>
            cell.owner === 1 &&
            cell.neighborToNeutral &&
            cell.canSpawn &&
            (cell.scrapAmount > 1 || !cell.inRangeOfRecycler) &&
            cell.island?.owner === "me" &&
            !cell.island.units &&
            !cell.island.fullOwned
        );
        if (closerToNeutralCell.length)
          this.action.spawn(1, closerToNeutralCell[0]);
      }
      time.getTime("compute time spawn near neutral");
    }
  }

  getActions(): string {
    return this.action.printActions().join(";");
  }
}

const [width, height]: number[] = readline().split(" ").map(Number);
const game = new Game(width, height);

// game loop
// eslint-disable-next-line no-constant-condition
while (true) {
  const [myMatter, oppMatter]: number[] = readline().split(" ").map(Number);
  game.newTurn(myMatter, oppMatter);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [
        scrapAmount,
        owner,
        units,
        recycler,
        canBuild,
        canSpawn,
        inRangeOfRecycler,
      ] = readline().split(" ").map(Number);
      game.updateCell([x, y], {
        scrapAmount,
        owner,
        units,
        recycler,
        canBuild,
        canSpawn,
        inRangeOfRecycler,
      });
    }
  }

  const time = new Performance();
  game.compute();
  time.getTotalTime("Total time");

  console.log(game.getActions());
}
