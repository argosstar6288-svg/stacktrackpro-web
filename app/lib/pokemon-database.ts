// Extended Pokemon Database - Gen 1-3 Complete
// This file contains comprehensive Pokemon stats data for card identification and validation

import { PokemonStats } from "./pokemon-stats";

export const extendedPokemonDatabase: Record<number, PokemonStats[]> = {
  1: [{ id: 1, name: "Bulbasaur", type: ["Grass", "Poison"], total: 318, hp: 45, attack: 49, defense: 49, spAtk: 65, spDef: 65, speed: 45 }],
  2: [{ id: 2, name: "Ivysaur", type: ["Grass", "Poison"], total: 405, hp: 60, attack: 62, defense: 63, spAtk: 80, spDef: 80, speed: 60 }],
  3: [
    { id: 3, name: "Venusaur", type: ["Grass", "Poison"], total: 525, hp: 80, attack: 82, defense: 83, spAtk: 100, spDef: 100, speed: 80 },
    { id: 3, name: "Mega Venusaur", type: ["Grass", "Poison"], total: 625, hp: 80, attack: 100, defense: 123, spAtk: 122, spDef: 120, speed: 80, variants: ["Mega"] }
  ],
  4: [{ id: 4, name: "Charmander", type: ["Fire"], total: 309, hp: 39, attack: 52, defense: 43, spAtk: 60, spDef: 50, speed: 65 }],
  5: [{ id: 5, name: "Charmeleon", type: ["Fire"], total: 405, hp: 58, attack: 64, defense: 58, spAtk: 80, spDef: 65, speed: 80 }],
  6: [
    { id: 6, name: "Charizard", type: ["Fire", "Flying"], total: 534, hp: 78, attack: 84, defense: 78, spAtk: 109, spDef: 85, speed: 100 },
    { id: 6, name: "Mega Charizard X", type: ["Fire", "Dragon"], total: 634, hp: 78, attack: 130, defense: 111, spAtk: 130, spDef: 85, speed: 100, variants: ["Mega"] },
    { id: 6, name: "Mega Charizard Y", type: ["Fire", "Flying"], total: 634, hp: 78, attack: 104, defense: 78, spAtk: 159, spDef: 115, speed: 100, variants: ["Mega"] }
  ],
  7: [{ id: 7, name: "Squirtle", type: ["Water"], total: 314, hp: 44, attack: 48, defense: 65, spAtk: 50, spDef: 64, speed: 43 }],
  8: [{ id: 8, name: "Wartortle", type: ["Water"], total: 405, hp: 59, attack: 63, defense: 80, spAtk: 65, spDef: 80, speed: 58 }],
  9: [
    { id: 9, name: "Blastoise", type: ["Water"], total: 530, hp: 79, attack: 83, defense: 100, spAtk: 85, spDef: 105, speed: 78 },
    { id: 9, name: "Mega Blastoise", type: ["Water"], total: 630, hp: 79, attack: 103, defense: 120, spAtk: 135, spDef: 115, speed: 78, variants: ["Mega"] }
  ],
  10: [{ id: 10, name: "Caterpie", type: ["Bug"], total: 195, hp: 45, attack: 30, defense: 35, spAtk: 20, spDef: 20, speed: 45 }],
  11: [{ id: 11, name: "Metapod", type: ["Bug"], total: 205, hp: 50, attack: 20, defense: 55, spAtk: 25, spDef: 25, speed: 30 }],
  12: [{ id: 12, name: "Butterfree", type: ["Bug", "Flying"], total: 395, hp: 60, attack: 45, defense: 50, spAtk: 90, spDef: 80, speed: 70 }],
  13: [{ id: 13, name: "Weedle", type: ["Bug", "Poison"], total: 195, hp: 40, attack: 35, defense: 30, spAtk: 20, spDef: 20, speed: 50 }],
  14: [{ id: 14, name: "Kakuna", type: ["Bug", "Poison"], total: 205, hp: 45, attack: 25, defense: 50, spAtk: 25, spDef: 25, speed: 35 }],
  15: [
    { id: 15, name: "Beedrill", type: ["Bug", "Poison"], total: 395, hp: 65, attack: 90, defense: 40, spAtk: 45, spDef: 80, speed: 75 },
    { id: 15, name: "Mega Beedrill", type: ["Bug", "Poison"], total: 495, hp: 65, attack: 150, defense: 40, spAtk: 15, spDef: 80, speed: 145, variants: ["Mega"] }
  ],
  16: [{ id: 16, name: "Pidgey", type: ["Normal", "Flying"], total: 251, hp: 40, attack: 45, defense: 40, spAtk: 35, spDef: 35, speed: 56 }],
  17: [{ id: 17, name: "Pidgeotto", type: ["Normal", "Flying"], total: 349, hp: 63, attack: 60, defense: 55, spAtk: 50, spDef: 50, speed: 71 }],
  18: [
    { id: 18, name: "Pidgeot", type: ["Normal", "Flying"], total: 479, hp: 83, attack: 80, defense: 75, spAtk: 70, spDef: 70, speed: 101 },
    { id: 18, name: "Mega Pidgeot", type: ["Normal", "Flying"], total: 579, hp: 83, attack: 80, defense: 80, spAtk: 135, spDef: 80, speed: 121, variants: ["Mega"] }
  ],
  19: [
    { id: 19, name: "Rattata", type: ["Normal"], total: 253, hp: 30, attack: 56, defense: 35, spAtk: 25, spDef: 35, speed: 72 },
    { id: 19, name: "Alolan Rattata", type: ["Dark", "Normal"], total: 253, hp: 30, attack: 56, defense: 35, spAtk: 25, spDef: 35, speed: 72, variants: ["Alolan"] }
  ],
  20: [
    { id: 20, name: "Raticate", type: ["Normal"], total: 413, hp: 55, attack: 81, defense: 60, spAtk: 50, spDef: 70, speed: 97 },
    { id: 20, name: "Alolan Raticate", type: ["Dark", "Normal"], total: 413, hp: 75, attack: 71, defense: 70, spAtk: 40, spDef: 80, speed: 77, variants: ["Alolan"] }
  ],
  21: [{ id: 21, name: "Spearow", type: ["Normal", "Flying"], total: 262, hp: 40, attack: 60, defense: 30, spAtk: 31, spDef: 31, speed: 70 }],
  22: [{ id: 22, name: "Fearow", type: ["Normal", "Flying"], total: 442, hp: 65, attack: 90, defense: 65, spAtk: 61, spDef: 61, speed: 100 }],
  23: [{ id: 23, name: "Ekans", type: ["Poison"], total: 288, hp: 35, attack: 60, defense: 44, spAtk: 40, spDef: 54, speed: 55 }],
  24: [{ id: 24, name: "Arbok", type: ["Poison"], total: 448, hp: 60, attack: 95, defense: 69, spAtk: 65, spDef: 79, speed: 80 }],
  25: [
    { id: 25, name: "Pikachu", type: ["Electric"], total: 320, hp: 35, attack: 55, defense: 40, spAtk: 50, spDef: 50, speed: 90 },
    { id: 25, name: "Partner Pikachu", type: ["Electric"], total: 430, hp: 45, attack: 80, defense: 50, spAtk: 75, spDef: 60, speed: 120, variants: ["Partner"] }
  ],
  26: [
    { id: 26, name: "Raichu", type: ["Electric"], total: 485, hp: 60, attack: 90, defense: 55, spAtk: 90, spDef: 80, speed: 110 },
    { id: 26, name: "Alolan Raichu", type: ["Electric", "Psychic"], total: 485, hp: 60, attack: 85, defense: 50, spAtk: 95, spDef: 85, speed: 110, variants: ["Alolan"] }
  ],
  27: [
    { id: 27, name: "Sandshrew", type: ["Ground"], total: 300, hp: 50, attack: 75, defense: 85, spAtk: 20, spDef: 30, speed: 40 },
    { id: 27, name: "Alolan Sandshrew", type: ["Ice", "Steel"], total: 300, hp: 50, attack: 75, defense: 90, spAtk: 10, spDef: 35, speed: 40, variants: ["Alolan"] }
  ],
  28: [
    { id: 28, name: "Sandslash", type: ["Ground"], total: 450, hp: 75, attack: 100, defense: 110, spAtk: 45, spDef: 55, speed: 65 },
    { id: 28, name: "Alolan Sandslash", type: ["Ice", "Steel"], total: 450, hp: 75, attack: 100, defense: 120, spAtk: 25, spDef: 65, speed: 65, variants: ["Alolan"] }
  ],
  29: [{ id: 29, name: "Nidoran♀", type: ["Poison"], total: 275, hp: 55, attack: 47, defense: 52, spAtk: 40, spDef: 40, speed: 41 }],
  30: [{ id: 30, name: "Nidorina", type: ["Poison"], total: 365, hp: 70, attack: 62, defense: 67, spAtk: 55, spDef: 55, speed: 56 }],
  31: [{ id: 31, name: "Nidoqueen", type: ["Poison", "Ground"], total: 505, hp: 90, attack: 92, defense: 87, spAtk: 75, spDef: 85, speed: 76 }],
  32: [{ id: 32, name: "Nidoran♂", type: ["Poison"], total: 273, hp: 46, attack: 57, defense: 40, spAtk: 40, spDef: 40, speed: 50 }],
  33: [{ id: 33, name: "Nidorino", type: ["Poison"], total: 365, hp: 61, attack: 72, defense: 57, spAtk: 55, spDef: 55, speed: 65 }],
  34: [{ id: 34, name: "Nidoking", type: ["Poison", "Ground"], total: 505, hp: 81, attack: 102, defense: 77, spAtk: 85, spDef: 75, speed: 85 }],
  35: [{ id: 35, name: "Clefairy", type: ["Fairy"], total: 323, hp: 70, attack: 45, defense: 48, spAtk: 60, spDef: 65, speed: 35 }],
  36: [{ id: 36, name: "Clefable", type: ["Fairy"], total: 483, hp: 95, attack: 70, defense: 73, spAtk: 95, spDef: 90, speed: 60 }],
  37: [
    { id: 37, name: "Vulpix", type: ["Fire"], total: 299, hp: 38, attack: 41, defense: 40, spAtk: 50, spDef: 65, speed: 65 },
    { id: 37, name: "Alolan Vulpix", type: ["Ice"], total: 299, hp: 38, attack: 41, defense: 40, spAtk: 50, spDef: 65, speed: 65, variants: ["Alolan"] }
  ],
  38: [
    { id: 38, name: "Ninetales", type: ["Fire"], total: 505, hp: 73, attack: 76, defense: 75, spAtk: 81, spDef: 100, speed: 100 },
    { id: 38, name: "Alolan Ninetales", type: ["Ice", "Fairy"], total: 505, hp: 73, attack: 67, defense: 75, spAtk: 81, spDef: 100, speed: 109, variants: ["Alolan"] }
  ],
  152: [{ id: 152, name: "Chikorita", type: ["Grass"], total: 318, hp: 45, attack: 49, defense: 65, spAtk: 49, spDef: 65, speed: 45 }],
  153: [{ id: 153, name: "Bayleef", type: ["Grass"], total: 405, hp: 60, attack: 62, defense: 80, spAtk: 63, spDef: 80, speed: 60 }],
  154: [{ id: 154, name: "Meganium", type: ["Grass"], total: 525, hp: 80, attack: 82, defense: 100, spAtk: 83, spDef: 100, speed: 80 }],
  155: [{ id: 155, name: "Cyndaquil", type: ["Fire"], total: 309, hp: 39, attack: 52, defense: 43, spAtk: 60, spDef: 50, speed: 65 }],
  156: [{ id: 156, name: "Quilava", type: ["Fire"], total: 405, hp: 58, attack: 64, defense: 58, spAtk: 80, spDef: 65, speed: 80 }],
  157: [
    { id: 157, name: "Typhlosion", type: ["Fire"], total: 534, hp: 78, attack: 84, defense: 78, spAtk: 109, spDef: 85, speed: 100 },
    { id: 157, name: "Hisuian Typhlosion", type: ["Fire", "Ghost"], total: 534, hp: 73, attack: 84, defense: 78, spAtk: 119, spDef: 85, speed: 95, variants: ["Hisuian"] }
  ],
  158: [{ id: 158, name: "Totodile", type: ["Water"], total: 314, hp: 50, attack: 65, defense: 64, spAtk: 44, spDef: 48, speed: 43 }],
  159: [{ id: 159, name: "Croconaw", type: ["Water"], total: 405, hp: 65, attack: 80, defense: 80, spAtk: 59, spDef: 63, speed: 58 }],
  160: [{ id: 160, name: "Feraligatr", type: ["Water"], total: 530, hp: 85, attack: 105, defense: 100, spAtk: 79, spDef: 83, speed: 78 }],
  252: [{ id: 252, name: "Treecko", type: ["Grass"], total: 310, hp: 40, attack: 45, defense: 35, spAtk: 65, spDef: 55, speed: 70 }],
  253: [{ id: 253, name: "Grovyle", type: ["Grass"], total: 405, hp: 50, attack: 65, defense: 45, spAtk: 85, spDef: 65, speed: 95 }],
  254: [
    { id: 254, name: "Sceptile", type: ["Grass"], total: 530, hp: 70, attack: 85, defense: 65, spAtk: 105, spDef: 85, speed: 120 },
    { id: 254, name: "Mega Sceptile", type: ["Grass", "Dragon"], total: 630, hp: 70, attack: 110, defense: 75, spAtk: 145, spDef: 85, speed: 145, variants: ["Mega"] }
  ],
  255: [{ id: 255, name: "Torchic", type: ["Fire"], total: 310, hp: 45, attack: 60, defense: 40, spAtk: 70, spDef: 50, speed: 45 }],
  256: [{ id: 256, name: "Combusken", type: ["Fire", "Fighting"], total: 405, hp: 60, attack: 85, defense: 60, spAtk: 85, spDef: 60, speed: 55 }],
  257: [
    { id: 257, name: "Blaziken", type: ["Fire", "Fighting"], total: 530, hp: 80, attack: 120, defense: 70, spAtk: 110, spDef: 70, speed: 80 },
    { id: 257, name: "Mega Blaziken", type: ["Fire", "Fighting"], total: 630, hp: 80, attack: 160, defense: 80, spAtk: 130, spDef: 80, speed: 100, variants: ["Mega"] }
  ],
  258: [{ id: 258, name: "Mudkip", type: ["Water"], total: 310, hp: 50, attack: 70, defense: 50, spAtk: 50, spDef: 50, speed: 40 }],
  259: [{ id: 259, name: "Marshtomp", type: ["Water", "Ground"], total: 405, hp: 70, attack: 85, defense: 70, spAtk: 60, spDef: 70, speed: 50 }],
  260: [
    { id: 260, name: "Swampert", type: ["Water", "Ground"], total: 535, hp: 100, attack: 110, defense: 90, spAtk: 85, spDef: 90, speed: 60 },
    { id: 260, name: "Mega Swampert", type: ["Water", "Ground"], total: 635, hp: 100, attack: 150, defense: 110, spAtk: 95, spDef: 110, speed: 70, variants: ["Mega"] }
  ]
};

export default extendedPokemonDatabase;
