/**
 * Auto-generated code below aims at helping you parse
 * the standard input according to the problem statement.
 **/

// game loop
let mesPotions = 0;
let advPotions = 0;
let advScore = 0;
const lastPotion = 5;
while (true) {
  const actionCount = Number(readline()); // the number of spells and recipes in play
  const commandes = [];
  const spells = [];
  const shop = [];
  for (let i = 0; i < actionCount; i++) {
    var inputs = readline().split(' ');
    const actionId = Number(inputs[0]); // the unique ID of this spell or recipe
    const actionType = inputs[1]; // in the first league: BREW; later: CAST, OPPONENT_CAST, LEARN, BREW
    const delta0 = Number(inputs[2]); // tier-0 ingredient change
    const delta1 = Number(inputs[3]); // tier-1 ingredient change
    const delta2 = Number(inputs[4]); // tier-2 ingredient change
    const delta3 = Number(inputs[5]); // tier-3 ingredient change
    const price = Number(inputs[6]); // the price in rupees if this is a potion
    const tomeIndex = Number(inputs[7]); // in the first two leagues: always 0; later: the index in the tome if this is a tome spell, equal to the read-ahead tax
    const taxCount = Number(inputs[8]); // in the first two leagues: always 0; later: the amount of taxed tier-0 ingredients you gain from learning this spell
    const castable = inputs[9] !== '0'; // in the first league: always 0; later: 1 if this is a castable player spell
    const repeatable = inputs[10] !== '0'; // for the first two leagues: always 0; later: 1 if this is a repeatable player spell
    if (actionType === 'BREW') {
      commandes.push({
        actionId,
        actionType,
        delta0,
        delta1,
        delta2,
        delta3,
        price,
        tomeIndex,
        taxCount,
        castable,
        repeatable,
      });
    } else if (actionType === 'CAST') {
      spells.push({
        actionId,
        actionType,
        delta0,
        delta1,
        delta2,
        delta3,
        price,
        tomeIndex,
        taxCount,
        castable,
        repeatable,
      });
    } else if (actionType === 'LEARN') {
      shop.push({
        actionId,
        actionType,
        delta0,
        delta1,
        delta2,
        delta3,
        price,
        tomeIndex,
        taxCount,
        castable,
        repeatable,
      });
    }
  }
  commandes.sort((a, b) => b.price - a.price);
  spells.sort((a, b) => {
    let apos = a.delta0 > 0 && a.delta1 > 0 && a.delta2 > 0 && a.delta3 > 0;
    let bpos = b.delta0 > 0 && b.delta1 > 0 && b.delta2 > 0 && b.delta3 > 0;
    if (apos && !bpos) return -1;
    if (bpos && apos) return 1;
    return 0;
  });
  //shop.sort( (a,b)=>a.tomeIndex - b.tomeIndex )
  /*{
        let apos = a.delta0>0 && a.delta1>0 && a.delta2>0 && a.delta3>0
        let bpos = b.delta0>0 && b.delta1>0 && b.delta2>0 && b.delta3>0
        if (apos && !bpos) return -1
        if (bpos && apos) return 1
        return 0
    } )*/
  console.error(spells);

  for (let i = 1; i >= 0; i--) {
    var inputs = readline().split(' ');
    const inv0 = Number(inputs[0]); // tier-0 ingredients in inventory
    const inv1 = Number(inputs[1]);
    const inv2 = Number(inputs[2]);
    const inv3 = Number(inputs[3]);
    const score = Number(inputs[4]); // amount of rupees

    if (i === 1) {
      // adv tour
      if (score !== advScore) {
        advScore = score;
        advPotions++;
      }
    } else {
      // mon tour
      // Commande prete ? On la fabrique
      let commande = commandes.find(
        c => -c.delta0 <= inv0 && -c.delta1 <= inv1 && -c.delta2 <= inv2 && -c.delta3 <= inv3,
      );

      // Un sort positif a acheter ?
      if (!commande) {
        commande = shop.find(
          spell =>
            spell.tomeIndex <= inv0 &&
            spell.delta0 >= 0 &&
            spell.delta1 >= 0 &&
            spell.delta2 >= 0 &&
            spell.delta3 >= 0,
        );
        console.error('un sort ?', commande);
      }

      // Recherche de commande a préparer
      if (!commande) {
        commandes.forEach(commande => {
          commande.turnsToPrepare =
            howManyTurns(
              [commande.delta0, commande.delta1, commande.delta2, commande.delta3],
              [inv0, inv1, inv2, inv3],
              spells,
            ) + 1;
          commande.valuePerTurn = commande.price / commande.turnsToPrepare;
        });
        if (mesPotions === lastPotion || advPotions === lastPotion) {
          // Hurry up !
          commandes.sort((a, b) => b.turnsToPrepare - a.turnsToPrepare); // TODO : améliorer en vérifiant que je peux gagner avec cette potion rapide
        } else {
          // Temps normal
          commandes.sort((a, b) => b.valuePerTurn - a.valuePerTurn);
        }

        commande = commandes[0];
        console.error('commande choisie :', commande);

        let spellIndex = nextSpellToCast(
          [commande.delta0, commande.delta1, commande.delta2, commande.delta3],
          [inv0, inv1, inv2, inv3],
          spells,
        );
        if (spellIndex !== -1) {
          console.error('spell to cast : ', spellIndex);
          commande = spells[spellIndex];
        } else [(commande = undefined)];
      }

      // Un truc a faire ?
      if (commande) {
        console.log(`${commande.actionType} ${commande.actionId} ${randomText()}`);
        if (commande.actionType === 'BREW') mesPotions++;

        // Rien a faire, on refresh !
      } else {
        console.log('REST Just Have a Break');
      }
    }
  }

  // in the first league: BREW <id> | WAIT; later: BREW <id> | CAST <id> [<times>] | LEARN <id> | REST | WAIT
}

function randomText() {
  let texts = [
    'TAKE MY BEER !',
    'She drop a booger in the potion, dont drink it !',
    'This fake mage is stealing you',
    'My beverage is the most famous of this country',
  ];
  return texts[Math.floor(Math.random() * texts.length)];
}

function howManyTurns(cost, bag, spells) {
  let need = [cost[0] + bag[0], cost[1] + bag[1], cost[2] + bag[2], cost[3] + bag[3]];
  let leftBag = [...bag];
  let leftSpells = spells.map(spell => Object.assign({}, spell));
  let turns = 0;
  turns =
    Math.ceil(Math.max(-need[0] / 2), 0) +
    Math.max(-need[1], 0) +
    Math.max(-need[2] * 2, 0) +
    Math.max(-need[3] * 3, 0);
  /*while (need[0]<0 || need[1]<0 || need[2]<0 || need[3]<0 ){
        let spellIndex = nextSpellToCast(cost,leftBag,leftSpells)
        if (spellIndex!==-1){
            if (!leftSpells[spellIndex].repeatable) leftSpells[spellIndex].castable = false
            for (let i = 0; i<4; i++){
                need[i] += leftSpells[spellIndex]['delta'+String(i)]
                leftBag[i] += leftSpells[spellIndex]['delta'+String(i)]
            }
        }else{ // Reset des sorts
            leftSpells.forEach(spell=> spell.castable = true)
        }
        turns++
    }*/
  return turns;
}
function nextSpellToCast(cost, bag, spells) {
  let need = [cost[0] + bag[0], cost[1] + bag[1], cost[2] + bag[2], cost[3] + bag[3]];
  let spellIndex = -1;
  console.error(cost, bag, spells);
  for (let i = 0; i < 4; i++) {
    if (need[i] < 0 && spellIndex === -1) {
      let recursiveIndex = -1;
      spellIndex = spells.findIndex(spell => {
        console.error(
          spell['delta0'] + bag[0],
          spell['delta1'] + bag[1],
          spell['delta2'] + bag[2],
          spell['delta3'] + bag[3],
        );
        if (recursiveIndex !== -1) return false;
        if (spell['delta' + String(i)] <= 0 || spell.castable === false) return false;
        if (
          spell['delta0'] + bag[0] < 0 ||
          spell['delta1'] + bag[1] < 0 ||
          spell['delta2'] + bag[2] < 0 ||
          spell['delta3'] + bag[3] < 0
        ) {
          // TODO : cas non géré si plusieurs sort permettent de fabriquer le meme ingrédient !
          recursiveIndex = nextSpellToCast(
            [spell['delta0'], spell['delta1'], spell['delta2'], spell['delta3']],
            [bag[0], bag[1], bag[2], bag[3]],
            spells,
          );
        } else {
          return (
            spell['delta0'] +
              bag[0] +
              spell['delta1'] +
              bag[1] +
              spell['delta2'] +
              bag[2] +
              spell['delta3'] +
              bag[3] <=
            10
          ); // Pas plus de 10 slots
        }
      });
      if (spellIndex === -1 && recursiveIndex !== -1) spellIndex = recursiveIndex;
    }
  }
  console.error(spellIndex);
  return spellIndex;
}
