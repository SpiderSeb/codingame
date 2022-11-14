type Coord = [x: number, y: number];

const isInsideCircle = (
  [centerX, centerY]: Coord,
  radius: number,
  [targetX, targetY]: Coord,
): boolean => {
  return Math.pow(centerX - targetX, 2) + Math.pow(centerY - targetY, 2) <= Math.pow(radius, 2);
};
const distanceBetween2Points = ([x1, y1]: Coord, [x2, y2]: Coord): number => {
  return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
};
const lineAndCircleIntersection = (
  [posX, posY]: Coord,
  [destX, destY]: Coord,
  [baseX, baseY]: Coord,
  radius: number,
): Coord => {
  // Special case : vertical line
  if (posX === destX) {
    // 1st point of intersection
    const y1 = baseY + Math.sqrt(radius * radius - Math.pow(posX - baseX, 2));
    const distance1 = Math.abs(posY - y1);
    // 2nd point of intersection
    const y2 = baseY - Math.sqrt(radius * radius - Math.pow(posX - baseX, 2));
    const distance2 = Math.abs(posY - y2);
    return distance1 < distance2 ? [posX, y1] : [posX, y2];
  }

  // line current direction : y = da * x + db
  const da = (posY - destY) / (posX - destX);
  const db = posY - posX * da;

  // Does the line intersect the circle ? D = b2 - 4ac
  const a = 1 + da * da;
  const b = -2 * baseX + 2 * da * (db - baseY);
  const c = baseX * baseX + Math.pow(db - baseY, 2) - radius * radius;
  const delta = b * b - 4 * a * c;
  // Never intersect
  if (delta < 0) return [Infinity, Infinity];

  // 1st point of intersection
  const x1 = (-b - Math.sqrt(delta)) / 2 / a;
  const y1 = da * x1 + db;
  // If only 1 point of intersection
  if (delta === 0) return [x1, y1];
  const distance1 = distanceBetween2Points([posX, posY], [x1, y1]);

  // 2nd point of intersection
  const x2 = (-b + Math.sqrt(delta)) / 2 / a;
  const y2 = da * x2 + db;
  const distance2 = distanceBetween2Points([posX, posY], [x2, y2]);

  // return smaller distance
  return distance1 < distance2 ? [x1, y1] : [x2, y2];
};
const circleAndCircleIntersection = (
  [c1X, c1Y]: Coord,
  c1R: number,
  [c2X, c2Y]: Coord,
  c2R: number,
  [closeX, closeY]: Coord,
): Coord => {
  // https://members.loria.fr/DRoegel/loc/note0001.pdf
  const a = 2 * (c2X - c1X);
  const b = 2 * (c2Y - c1Y);
  const c = Math.pow(c2X - c1X, 2) + Math.pow(c2Y - c1Y, 2) - c2R * c2R + c1R * c1R;
  const delta = Math.pow(2 * a * c, 2) - 4 * (a * a + b * b) * (c * c - b * b * c1R * c1R);
  if (delta < 0) return [Infinity, Infinity];
  const x1 = c1X + (2 * a * c - Math.sqrt(delta)) / 2 / (a * a + b * b);
  const y1 = c1Y + (c - a * (x1 - c1X)) / b;
  if (delta === 0) return [x1, y1];
  const x2 = c1X + (2 * a * c + Math.sqrt(delta)) / 2 / (a * a + b * b);
  const y2 = c1Y + (c - a * (x2 - c1X)) / b;
  const distance1 = distanceBetween2Points([closeX, closeY], [x1, y1]);
  const distance2 = distanceBetween2Points([closeX, closeY], [x2, y2]);
  return distance1 < distance2 ? [x1, y1] : [x2, y2];
};
const positionAfterMove = ([posX, posY]: Coord, [vX, vY]: Coord, distance: number): Coord => {
  const vd = distanceBetween2Points([posX, posY], [vX, vY]);
  const x = (distance / vd) * (vX - posX) + posX;
  const y = (distance / vd) * (vY - posY) + posY;
  return [Math.round(x), Math.round(y)];
};

class Entity {
  TYPE_MONSTER = 0;
  TYPE_MY_HERO = 1;
  TYPE_ENEMY_HERO = 2;
  MY_BASE = 1;
  ENEMY_BASE = 2;
  directDistanceFromMyBase: number;
  directDistanceFromEnemyBase: number;
  pathDistanceFromBase: number;
  pathIntersectionBaseRadius: { x: number; y: number } = { x: undefined, y: undefined };
  turnsBeforeHit: number | undefined;
  isNeutralized: boolean;
  constructor(
    public id: number,
    public type: number,
    public x: number,
    public y: number,
    public shieldLife: number,
    public isControlled: number,
    public health: number,
    public vx: number,
    public vy: number,
    public nearBase: number,
    public threatFor: number,
    private game: Game,
  ) {
    this.isNeutralized = false;
    this.directDistanceFromMyBase = this.getDistanceFrom([
      this.game.me.basePosX,
      this.game.me.basePosY,
    ]);
    this.directDistanceFromEnemyBase = this.getDistanceFrom([
      this.game.enemy.basePosX,
      this.game.enemy.basePosY,
    ]);

    if (type === this.TYPE_MONSTER) {
      if (threatFor === this.MY_BASE) {
        [
          this.pathDistanceFromBase,
          this.pathIntersectionBaseRadius.x,
          this.pathIntersectionBaseRadius.y,
        ] = this.monsterPathToBase(
          [x, y],
          [x + vx, y + vy],
          [this.game.me.basePosX, this.game.me.basePosY],
        );
        this.turnsBeforeHit = Math.floor((this.pathDistanceFromBase - 300) / 400);
      }
      if (threatFor === this.ENEMY_BASE) {
        [
          this.pathDistanceFromBase,
          this.pathIntersectionBaseRadius.x,
          this.pathIntersectionBaseRadius.y,
        ] = this.monsterPathToBase(
          [x, y],
          [x + vx, y + vy],
          [this.game.enemy.basePosX, this.game.enemy.basePosY],
        );
        this.turnsBeforeHit = Math.floor((this.pathDistanceFromBase - 300) / 400);
      }
      // sometimes vx/vy not yet updated when controlling
      if (isNaN(this.pathDistanceFromBase) && this.isControlled) {
        this.threatFor = 0;
        this.pathDistanceFromBase = undefined;
        this.pathIntersectionBaseRadius.x = undefined;
        this.pathIntersectionBaseRadius.y = undefined;
        this.turnsBeforeHit = undefined;
      }
    }
  }
  isMonster = (): boolean => {
    return this.type === this.TYPE_MONSTER;
  };
  isMyHero = (): boolean => {
    return this.type === this.TYPE_MY_HERO;
  };
  isEnemyHero = (): boolean => {
    return this.type === this.TYPE_ENEMY_HERO;
  };
  isDangerousForMyBase = (): boolean => {
    return this.threatFor === this.MY_BASE && !this.isNeutralized;
  };
  isDangerousForEnemy = (): boolean => {
    return this.threatFor === this.ENEMY_BASE;
  };
  willHitMyBase = (): boolean => {
    return this.turnsBeforeHit === 0;
  };
  canHitMyBase = (): boolean => {
    if (this.willHitMyBase()) return true;

    // Can hit if an enemy wind the monster
    if (
      this.shieldLife === 0 &&
      this.directDistanceFromMyBase <= 2900 &&
      this.game.enemy.canCast()
    ) {
      const enemyAbleToCast = this.game.enemy.heros.find(
        hero => hero.getDistanceFrom([this.x, this.y]) <= 1280,
      );
      if (enemyAbleToCast) return true;
    }
    return false;
  };
  getDistanceFrom = (coord: Coord): number => {
    return distanceBetween2Points([this.x, this.y], coord);
  };
  getFuturePosition = (turns: number): Coord => {
    const totalDistance = (turns < 1 ? 1 : turns) * 400;
    if (!this.threatFor) {
      // Neutral enemy: move in straight line
      return positionAfterMove(
        [this.x, this.y],
        [this.x + this.vx, this.y + this.vy],
        totalDistance,
      );
    }
    const distanceToIntersect = this.getDistanceFrom([
      this.pathIntersectionBaseRadius.x,
      this.pathIntersectionBaseRadius.y,
    ]);
    if (distanceToIntersect >= totalDistance) {
      // move less than intersect
      return positionAfterMove(
        [this.x, this.y],
        [this.x + this.vx, this.y + this.vy],
        totalDistance,
      );
    }
    const targetY =
      this.threatFor === this.MY_BASE ? this.game.me.basePosY : this.game.enemy.basePosY;
    const targetX =
      this.threatFor === this.MY_BASE ? this.game.me.basePosX : this.game.enemy.basePosX;
    return positionAfterMove(
      [this.pathIntersectionBaseRadius.x, this.pathIntersectionBaseRadius.y],
      [targetX, targetY],
      totalDistance - distanceToIntersect,
    );
  };
  getCoordMonsterFollow = (): Coord => {
    // Far monster, go in front
    if (this.directDistanceFromEnemyBase > 4000) {
      return [Math.round(this.x + 2.1 * this.vx), Math.round(this.y + 2.1 * this.vy)];
    }
    const ax = Math.abs(this.game.enemy.basePosX - this.x);
    const ay = Math.abs(this.game.enemy.basePosY - this.y);
    this.game.debug('coord follow', ax, ay);
    // monster at 45°, go back
    if (ax === ay) {
      return [Math.round(this.x - 2.1 * this.vx), Math.round(this.y - 2.1 * this.vy)];
    }
    // Monster < 45° go below : x-> +vy, y-> -vx
    if (ax > ay) {
      this.game.debug(
        'ax > ay',
        this.x,
        this.y,
        this.vx,
        this.vy,
        Math.round(this.x + 2.1 * this.vy),
        Math.round(this.y - 2.1 * this.vx),
      );
      return [Math.round(this.x + 2.1 * this.vy), Math.round(this.y - 2.1 * this.vx)];
    }
    // Monster > 45° go below : x-> -vy, y-> + vx
    this.game.debug(
      'ax < ay',
      this.x,
      this.y,
      this.vx,
      this.vy,
      Math.round(this.x - 2.1 * this.vy),
      Math.round(this.y + 2.1 * this.vx),
    );
    return [Math.round(this.x - 2.1 * this.vy), Math.round(this.y + 2.1 * this.vx)];
  };
  getCoordToInterceptMonster = (monster: Entity): Coord => {
    const distanceToClosestEnemy = this.getDistanceFrom([monster.x, monster.y]);
    const turnsToJoin = Math.floor((distanceToClosestEnemy - 800) / 800);
    const [targetX, targetY] = monster.getFuturePosition(turnsToJoin - 1);
    if (isNaN(targetX)) this.game.debug('isnan', monster);
    return [targetX, targetY];
  };
  getCoordToInterceptEnemy = (enemy: Entity, monster: Entity): Coord => {
    // Try to place hero on the circle of 840 around the monster, on the direct path of the enemy

    const enemyStickMonster = isInsideCircle([monster.x, monster.y], 850, [enemy.x, enemy.y]);
    // closest enemy intersect of the 840 circle with the direct enemy path
    const [intersectX, intersectY] = enemyStickMonster
      ? // Simplier version if enemy stick monster : go in front of monster
        [monster.x + 2.1 * monster.vx, monster.y + 2.1 * monster.vy]
      : lineAndCircleIntersection(
          [enemy.x, enemy.y],
          [monster.x, monster.y],
          [monster.x, monster.y],
          840,
        );

    // If this point is in hero range, go to!
    if (this.getDistanceFrom([intersectX, intersectY]) <= 800)
      return [Math.round(intersectX), Math.round(intersectY)];

    // If hero is far from monster, go closer
    if (this.getDistanceFrom([monster.x, monster.y]) >= 1610)
      return [Math.round(intersectX), Math.round(intersectY)];

    const [closeX, closeY] = circleAndCircleIntersection(
      [this.x, this.y],
      800,
      [monster.x, monster.y],
      840,
      [intersectX, intersectY],
    );
    return [Math.round(closeX), Math.round(closeY)];

    //return [Math.round(monster.x - 2.1 * monster.vx), Math.round(monster.y - 2.1 * monster.vy)]
  };
  monsterPathToBase = (
    [posX, posY]: Coord,
    [vX, vY]: Coord,
    [baseX, baseY]: Coord,
  ): [distance: number, baseRadiusIntersectionX: number, baseRadiusIntersectionY: number] => {
    const directDistance = distanceBetween2Points([posX, posY], [baseX, baseY]);
    // Monster inside base range
    if (directDistance <= this.game.baseRadius) return [directDistance, posX, posY];

    // Special case : vertical monster
    if (posX === vX) {
      // 1st point of intersection
      const y1 =
        baseY + Math.sqrt(this.game.baseRadius * this.game.baseRadius - Math.pow(posX - baseX, 2));
      const distance1 = Math.abs(posY - y1);
      // 2nd point of intersection
      const y2 =
        baseY - Math.sqrt(this.game.baseRadius * this.game.baseRadius - Math.pow(posX - baseX, 2));
      const distance2 = Math.abs(posY - y2);
      return distance1 < distance2
        ? [distance1 + this.game.baseRadius, posX, y1]
        : [distance2 + this.game.baseRadius, posX, y2];
    }

    // Monster current direction : y = da * x + db
    const da = (posY - vY) / (posX - vX);
    const db = posY - posX * da;

    // Does the monster intersect the base range ? D = b2 - 4ac
    const a = 1 + da * da;
    const b = -2 * baseX + 2 * da * (db - baseY);
    const c = baseX * baseX + Math.pow(db - baseY, 2) - this.game.baseRadius * this.game.baseRadius;
    const delta = b * b - 4 * a * c;
    // Never intersect
    if (delta < 0) return [Infinity, Infinity, Infinity];

    // 1st point of intersection
    const x1 = (-b - Math.sqrt(delta)) / 2 / a;
    const y1 = da * x1 + db;
    const distance1 = distanceBetween2Points([posX, posY], [x1, y1]);
    // If only 1 point of intersection
    if (delta === 0) return [distance1 + this.game.baseRadius, x1, y1];

    // 2nd point of intersection
    const x2 = (-b + Math.sqrt(delta)) / 2 / a;
    const y2 = da * x2 + db;
    const distance2 = distanceBetween2Points([posX, posY], [x2, y2]);

    // return smaller distance
    return distance1 < distance2
      ? [distance1 + this.game.baseRadius, x1, y1]
      : [distance2 + this.game.baseRadius, x2, y2];
  };
}

class Player {
  heros: Entity[];
  constructor(
    public basePosX: number,
    public basePosY: number,
    public baseHealth: number,
    public mana: number,
  ) {
    this.heros = [];
  }
  setHealth = (value: number) => {
    this.baseHealth = value;
  };
  setMana = (value: number) => {
    this.mana = value;
  };
  canCast = (): boolean => {
    return this.mana >= 10;
  };
  canSecureCast = (secureLevel: number): boolean => {
    return this.mana >= 10 * (secureLevel + 1);
  };
  coordToBase = ([x, y]: Coord): Coord => {
    return [Math.abs(this.basePosX - x), Math.abs(this.basePosY - y)];
  };
}

class Action {
  constructor(private game: Game) {}

  wait = (message = ''): string => {
    return `WAIT ${message}`;
  };
  move = ([x, y]: Coord, message = ''): string => {
    return `MOVE ${x} ${y} ${message}`;
  };
  castWind = ([x, y]: Coord, message = ''): string => {
    this.game.me.setMana(this.game.me.mana - 10);
    return `SPELL WIND ${x} ${y} ${message}`;
  };
  castShield = (entityId: number, message = ''): string => {
    this.game.me.setMana(this.game.me.mana - 10);
    return `SPELL SHIELD ${entityId} ${message}`;
  };
  castControl = (entityId: number, [x, y]: Coord, message = ''): string => {
    this.game.me.setMana(this.game.me.mana - 10);
    return `SPELL CONTROL ${entityId} ${x} ${y} ${message}`;
  };
}

class Game {
  me: Player;
  enemy: Player;
  monsters: Entity[];
  action: Action;
  turn: number;
  baseRadius = 5000;
  // Remember third hero roaming path
  thirdHeroRoamingBase: number;
  thirdHeroRoamingPath: string;
  way: Record<number, Record<string, Coord>>;
  isDebugging = false;

  constructor(baseX: number, baseY: number, private heroes: number) {
    this.me = new Player(baseX, baseY, 3, 0);
    this.enemy = new Player(baseX === 0 ? 17630 : 0, baseY === 0 ? 9000 : 0, 3, 0);
    this.action = new Action(this);
    this.turn = 0;
    this.way = {
      1: { base: [this.enemy.basePosX, this.enemy.basePosY] },
      10: {
        toTop: this.enemy.coordToBase([7000, 2600]),
        toBottom: this.enemy.coordToBase([2600, 7000]),
      },
      50: {
        farTop: this.enemy.coordToBase([6300, 1200]),
        closeCenter: this.enemy.coordToBase([3000, 3000]),
        farBottom: this.enemy.coordToBase([1200, 6300]),
        closeBottom: this.enemy.coordToBase([1200, 4500]),
        farCenter: this.enemy.coordToBase([4500, 4500]),
        closeTop: this.enemy.coordToBase([4500, 1200]),
      },
    };
  }

  newTurn = (health: number, mana: number, enemyHealth: number, enemyMana: number) => {
    this.turn++;
    this.me.setHealth(health);
    this.me.setMana(mana);
    this.me.heros = [];
    this.enemy.setHealth(enemyHealth);
    this.enemy.setMana(enemyMana);
    this.enemy.heros = [];
    this.monsters = [];
  };

  addEntity = (entity: Entity) => {
    if (entity.isMonster()) {
      this.monsters.push(entity);
    } else if (entity.isMyHero()) {
      this.me.heros.push(entity);
    } else if (entity.isEnemyHero()) {
      this.enemy.heros.push(entity);
    } else {
      this.debug('UNKNOWN ENTITY:', entity);
    }
  };
  findClosestDangerousMonster = (): Entity | undefined => {
    const targets = this.monsters.filter(({ isDangerousForMyBase }) => isDangerousForMyBase());
    if (!targets.length) return;
    const closest = targets.sort((a, b) => a.pathDistanceFromBase - b.pathDistanceFromBase)[0];
    return closest;
  };
  findClosestHeroMonster = (hero: Entity, monsters: Entity[]): Entity | undefined => {
    if (!monsters.length) return;
    // TODO ameliorer les perf !!!
    const closest = monsters.sort(
      (a, b) =>
        distanceBetween2Points([a.x, a.y], [hero.x, hero.y]) -
        distanceBetween2Points([b.x, b.y], [hero.x, hero.y]),
    )[0];
    return closest;
  };
  firstHeroAction = (): string => {
    const closestEnemy = this.findClosestDangerousMonster();
    const hero = this.me.heros[0];
    if (closestEnemy) {
      if (closestEnemy.canHitMyBase()) {
        if (this.me.canCast() && closestEnemy.health > 2 && closestEnemy.shieldLife === 0) {
          return this.action.castWind([this.enemy.basePosX, this.enemy.basePosY]);
        }
      }

      // try to change target to neutral
      if (
        this.turn > 100 &&
        !closestEnemy.shieldLife &&
        this.me.canSecureCast(12) &&
        closestEnemy.health > 10 &&
        closestEnemy.directDistanceFromMyBase >= 3000
      ) {
        const distanceFromHero = hero.getDistanceFrom([closestEnemy.x, closestEnemy.y]);
        if (distanceFromHero <= 1280) {
          closestEnemy.isNeutralized = true;
          return this.action.castWind([hero.x - closestEnemy.vx, hero.y - closestEnemy.vy]);
        }
        if (
          distanceFromHero <= 2200 &&
          closestEnemy.directDistanceFromMyBase > 4600 &&
          !closestEnemy.isControlled
        ) {
          closestEnemy.isNeutralized = true;
          return this.action.castControl(closestEnemy.id, [
            closestEnemy.x - 2 * closestEnemy.vx,
            closestEnemy.y - 2 * closestEnemy.vy,
          ]);
        }
      }

      // Dont need help
      if (closestEnemy.health / 2 <= closestEnemy.turnsBeforeHit + 1) {
        closestEnemy.isNeutralized = true;
      }
      const target = hero.getCoordToInterceptMonster(closestEnemy);
      return this.action.move(target);
    }

    // No dangerous target, search closest not yet managed target
    const monsters = this.monsters.filter(
      ({ isNeutralized, isDangerousForEnemy }) => !isNeutralized && !isDangerousForEnemy(),
    );
    if (monsters.length) {
      const monster = this.findClosestHeroMonster(hero, monsters);
      const target = hero.getCoordToInterceptMonster(monster);
      return this.action.move(target);
    }
    // No target, walk
    return this.action.move(this.me.coordToBase([3500, 6500]));
    // TODO : detecter les joueurs qui repoussent mes héros loin des araignées : mémoriser la position prévue de chaque héros dans la baseRadius a la fin d'un tour. Si au début du tour suivantla nouvelle position est plus loin (prévoir une marge d'erreur) qu'elle ne devrait : winder ! (au moins couteux, on peut check la différence de distance directe a la base : si + de 1500 entre 2 tours, ya forcément eu un wind)
    // Si un enemi utilise la tech du wind et que on a une araignée protégée => perma protect a faire
  };
  secondHeroAction = (): string => {
    const closestEnemy = this.findClosestDangerousMonster();
    const hero = this.me.heros[1];
    if (closestEnemy) {
      if (closestEnemy.canHitMyBase()) {
        if (this.me.canCast() && closestEnemy.health > 2 && closestEnemy.shieldLife === 0) {
          closestEnemy.isNeutralized = true;
          return this.action.castWind([this.enemy.basePosX, this.enemy.basePosY]);
        }
      }

      // try to change target to neutral
      if (
        this.turn > 100 &&
        !closestEnemy.shieldLife &&
        this.me.canSecureCast(12) &&
        closestEnemy.health > 10 &&
        closestEnemy.directDistanceFromMyBase >= 3000
      ) {
        const distanceFromHero = hero.getDistanceFrom([closestEnemy.x, closestEnemy.y]);
        if (distanceFromHero <= 1280) {
          closestEnemy.isNeutralized = true;
          return this.action.castWind([hero.x - closestEnemy.vx, hero.y - closestEnemy.vy]);
        }
        if (
          distanceFromHero <= 2200 &&
          closestEnemy.directDistanceFromMyBase > 4600 &&
          !closestEnemy.isControlled
        ) {
          closestEnemy.isNeutralized = true;
          return this.action.castControl(closestEnemy.id, [
            closestEnemy.x - 2 * closestEnemy.vx,
            closestEnemy.y - 2 * closestEnemy.vy,
          ]);
        }
      }

      // Dont need help
      if (closestEnemy.health / 2 <= closestEnemy.turnsBeforeHit + 1) {
        closestEnemy.isNeutralized = true;
      }
      const target = hero.getCoordToInterceptMonster(closestEnemy);
      return this.action.move(target);
    }
    // No dangerous target, search closest not yet managed target
    const monsters = this.monsters.filter(
      ({ isNeutralized, isDangerousForEnemy }) => !isNeutralized && !isDangerousForEnemy(),
    );
    if (monsters.length) {
      const monster = this.findClosestHeroMonster(hero, monsters);
      const target = hero.getCoordToInterceptMonster(monster);
      return this.action.move(target);
    }
    // No target, walk
    return this.action.move(this.me.coordToBase([8000, 2500]));
  };
  thirdHeroAction = (): string => {
    const hero = this.me.heros[2];

    // Go to ennemy base
    if (hero.directDistanceFromEnemyBase > 10000) {
      this.debug('too far from enemi base');
      return this.action.move([this.enemy.basePosX, this.enemy.basePosY]);
    }
    // Go help ennemi
    if (this.turn < 50) {
      const monsters = this.monsters.filter(
        monster => !monster.isDangerousForMyBase() && monster.directDistanceFromEnemyBase <= 10000,
      );
      if (monsters.length) {
        const closest = this.findClosestHeroMonster(hero, monsters);
        const target = hero.getCoordToInterceptMonster(closest);
        this.debug('help enemi', closest.id);
        return this.action.move(target);
      }
    }

    // Try to protect spider that can hit
    if (this.turn > 100 && this.me.canSecureCast(6)) {
      const winningMonsters = this.monsters.filter(
        monster => monster.shieldLife && monster.isDangerousForEnemy(),
      );
      if (winningMonsters.length) {
        const closestMonsterToProtect = this.findClosestHeroMonster(hero, winningMonsters);
        const ataignableEnemy = this.enemy.heros.filter(
          enemy =>
            !enemy.shieldLife &&
            enemy.getDistanceFrom([hero.x, hero.y]) <= 1280 &&
            hero.getDistanceFrom([
              enemy.x + closestMonsterToProtect.vx,
              enemy.y + closestMonsterToProtect.vy,
            ]) <= 1280,
        );
        if (ataignableEnemy.length) {
          return this.action.castWind([this.me.basePosX, this.me.basePosY]);
        }

        const defensiveNotShieldedEnemy = this.enemy.heros.filter(
          enemy => !enemy.shieldLife && enemy.directDistanceFromEnemyBase < 5000,
        );

        if (defensiveNotShieldedEnemy.length) {
          // Defensive enemy, protect the spider
          const closestEnemyToIntercept = this.findClosestHeroMonster(
            hero,
            defensiveNotShieldedEnemy,
          );
          this.debug('intercept', closestEnemyToIntercept.id, closestMonsterToProtect.id);
          const target = hero.getCoordToInterceptEnemy(
            closestEnemyToIntercept,
            closestMonsterToProtect,
          );
          return this.action.move(target);
        }
        // Cannot see all enemies, follow monster
        if (this.enemy.heros.length < 3) {
          this.debug('protect');
          const target = closestMonsterToProtect.getCoordMonsterFollow();
          return this.action.move(target);
        }
      }
    }

    if (this.turn > 50 && this.me.canSecureCast(10)) {
      const canBeWinningMonsters = this.monsters.filter(
        monster =>
          monster.health > 12 &&
          monster.isDangerousForEnemy() &&
          monster.pathDistanceFromBase < 6000,
      );
      if (canBeWinningMonsters.length) {
        const ataignableEnemy = this.enemy.heros.filter(
          enemy =>
            !enemy.shieldLife &&
            !enemy.isControlled &&
            enemy.getDistanceFrom([hero.x, hero.y]) <= 2200,
        );
        if (ataignableEnemy.length) {
          return this.action.castControl(ataignableEnemy[0].id, [
            this.me.basePosX,
            this.me.basePosY,
          ]);
        }
      }
    }

    if (this.turn > 80 && this.me.canSecureCast(3)) {
      const monstersToShield = this.monsters.filter(
        monster =>
          monster.health >= 16 &&
          monster.isDangerousForEnemy() &&
          !monster.shieldLife &&
          monster.pathDistanceFromBase <= 5100 &&
          monster.getDistanceFrom([hero.x, hero.y]) <= 2200,
      );
      if (monstersToShield.length) {
        return this.action.castShield(monstersToShield[0].id);
      }
    }
    if (this.turn > 50 && this.me.canSecureCast(3)) {
      const monstersToControl = this.monsters.filter(
        monster =>
          monster.health >= 15 &&
          (!monster.threatFor || monster.isDangerousForMyBase()) &&
          !monster.shieldLife &&
          !monster.isControlled &&
          monster.getDistanceFrom([hero.x, hero.y]) <= 2200,
      );
      if (monstersToControl.length) {
        return this.action.castControl(monstersToControl[0].id, [
          this.enemy.basePosX,
          this.enemy.basePosY,
        ]);
      }
    }
    if (this.turn > 100 && this.me.canSecureCast(10)) {
      const monstersToWind = this.monsters.filter(
        monster =>
          !monster.shieldLife &&
          Math.abs(hero.directDistanceFromEnemyBase - monster.directDistanceFromEnemyBase) <=
            1280 &&
          monster.getDistanceFrom([hero.x, hero.y]) <= 1280,
      );
      if (monstersToWind.length > 1) {
        return this.action.castWind([this.enemy.basePosX, this.enemy.basePosY]);
      }
    }

    // No annoyable target, search closest not yet managed target
    const targets = this.monsters.filter(
      ({ isNeutralized, isDangerousForEnemy, directDistanceFromEnemyBase }) =>
        !isNeutralized && !isDangerousForEnemy() && directDistanceFromEnemyBase < 8000,
    );
    if (targets.length) {
      const closest = this.findClosestHeroMonster(hero, targets);
      const target = hero.getCoordToInterceptMonster(closest);
      return this.action.move(target);
    }

    // TODO try to dodge incoming monster

    // TODO : surveiller le path de l'attaquant, est il bon ?
    // No target, walk
    return this.action.move(this.way[this.thirdHeroRoamingBase][this.thirdHeroRoamingPath]);
  };
  compute = () => {
    const hero = this.me.heros[2];
    if (this.way[this.turn]) {
      this.thirdHeroRoamingBase = this.turn;
      this.thirdHeroRoamingPath = Object.keys(this.way[this.turn])[0];
      this.debug('switch to path', this.thirdHeroRoamingPath);
    }

    const [x, y] = this.way[this.thirdHeroRoamingBase][this.thirdHeroRoamingPath];
    if (hero.x >= x - 100 && hero.x <= x + 100 && hero.y >= y - 100 && hero.y <= y + 100) {
      this.debug('path ok', this.thirdHeroRoamingPath);
      const keys = Object.keys(this.way[this.thirdHeroRoamingBase]);
      const index = keys.findIndex(key => key === this.thirdHeroRoamingPath) + 1;
      if (index === keys.length) {
        this.thirdHeroRoamingPath = keys[0];
      } else {
        this.thirdHeroRoamingPath = keys[index];
      }
      this.debug('next path', this.thirdHeroRoamingPath);
    }
  };
  getNextWalk = (): Coord => {
    return this.way[this.thirdHeroRoamingBase][this.thirdHeroRoamingPath];
  };
  nextAction = (hero: number): string => {
    if (hero === 0) {
      return this.firstHeroAction();
    }
    if (hero === 1) {
      return this.secondHeroAction();
    }
    return this.thirdHeroAction();
  };
  debug = (message: string, ...rest) => {
    if (this.isDebugging) console.error(message, ...rest);
  };
}

const [baseX, baseY] = readline().split(' ').map(Number); // The corner of the map representing your base
const heroesPerPlayer: number = Number(readline()); // Always 3
const game = new Game(baseX, baseY, heroesPerPlayer);

// game loop
while (true) {
  const myBaseInput: number[] = readline().split(' ').map(Number);
  const enemyBaseInput: number[] = readline().split(' ').map(Number);
  game.newTurn(myBaseInput[0], myBaseInput[1], enemyBaseInput[0], enemyBaseInput[1]);

  const entityCount: number = Number(readline()); // Amount of heros and monsters you can see
  for (let i = 0; i < entityCount; i++) {
    var inputs: number[] = readline().split(' ').map(Number);
    game.addEntity(
      new Entity(
        inputs[0], // Unique identifier
        inputs[1], // 0=monster, 1=your hero, 2=opponent hero
        inputs[2], // Position of this entity
        inputs[3],
        inputs[4], // Ignore for this league; Count down until shield spell fades
        inputs[5], // Ignore for this league; Equals 1 when this entity is under a control spell
        inputs[6], // Remaining health of this monster
        inputs[7], // Trajectory of this monster
        inputs[8],
        inputs[9], // 0=monster with no target yet, 1=monster targeting a base
        inputs[10], // Given this monster's trajectory, is it a threat to 1=your base, 2=your opponent's base, 0=neither
        game,
      ),
    );
  }
  game.compute();

  for (let i = 0; i < heroesPerPlayer; i++) {
    console.log(game.nextAction(i));
  }
}
