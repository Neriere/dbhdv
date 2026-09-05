// Base de datos oficial y completa de todas las 105 Runas de Dofus (typeId: 78)
// Incluye Runas Base, Runas Bu (Pa), Runas Su (Ra), Daños, Resistencias, Especiales y Dofus 3.

export interface DofusRuneItem {
  id: number;
  name: {
    es: string;
    fr: string;
    en: string;
  };
  level: number;
  iconId: number;
  typeId: number;
}

export const ALL_DOFUS_RUNES: DofusRuneItem[] = [
  {
    "id": 1519,
    "name": {
      "es": "Runa Fu",
      "fr": "Rune Fo",
      "en": "Str Rune"
    },
    "level": 1,
    "iconId": 78043,
    "typeId": 78
  },
  {
    "id": 1521,
    "name": {
      "es": "Runa Sa",
      "fr": "Rune Sa",
      "en": "Wis Rune"
    },
    "level": 15,
    "iconId": 78049,
    "typeId": 78
  },
  {
    "id": 1522,
    "name": {
      "es": "Runa Inte",
      "fr": "Rune Ine",
      "en": "Int Rune"
    },
    "level": 1,
    "iconId": 78037,
    "typeId": 78
  },
  {
    "id": 1523,
    "name": {
      "es": "Runa Vi",
      "fr": "Rune Vi",
      "en": "Vit Rune"
    },
    "level": 1,
    "iconId": 78052,
    "typeId": 78
  },
  {
    "id": 1524,
    "name": {
      "es": "Runa Agi",
      "fr": "Rune Age",
      "en": "Agi Rune"
    },
    "level": 1,
    "iconId": 78046,
    "typeId": 78
  },
  {
    "id": 1525,
    "name": {
      "es": "Runa Sue",
      "fr": "Rune Cha",
      "en": "Cha Rune"
    },
    "level": 1,
    "iconId": 78040,
    "typeId": 78
  },
  {
    "id": 1545,
    "name": {
      "es": "Runa Bu Fu",
      "fr": "Rune Pa Fo",
      "en": "Pa Str Rune"
    },
    "level": 5,
    "iconId": 78044,
    "typeId": 78
  },
  {
    "id": 1546,
    "name": {
      "es": "Runa Bu Sa",
      "fr": "Rune Pa Sa",
      "en": "Pa Wis Rune"
    },
    "level": 20,
    "iconId": 78050,
    "typeId": 78
  },
  {
    "id": 1547,
    "name": {
      "es": "Runa Bu Inte",
      "fr": "Rune Pa Ine",
      "en": "Pa Int Rune"
    },
    "level": 5,
    "iconId": 78038,
    "typeId": 78
  },
  {
    "id": 1548,
    "name": {
      "es": "Runa Bu Vi",
      "fr": "Rune Pa Vi",
      "en": "Pa Vit Rune"
    },
    "level": 5,
    "iconId": 78053,
    "typeId": 78
  },
  {
    "id": 1549,
    "name": {
      "es": "Runa Bu Agi",
      "fr": "Rune Pa Age",
      "en": "Pa Agi Rune"
    },
    "level": 5,
    "iconId": 78047,
    "typeId": 78
  },
  {
    "id": 1550,
    "name": {
      "es": "Runa Bu Sue",
      "fr": "Rune Pa Cha",
      "en": "Pa Cha Rune"
    },
    "level": 5,
    "iconId": 78041,
    "typeId": 78
  },
  {
    "id": 1551,
    "name": {
      "es": "Runa Su Fu",
      "fr": "Rune Ra Fo",
      "en": "Ra Str Rune"
    },
    "level": 10,
    "iconId": 78045,
    "typeId": 78
  },
  {
    "id": 1552,
    "name": {
      "es": "Runa Su Sa",
      "fr": "Rune Ra Sa",
      "en": "Ra Wis Rune"
    },
    "level": 25,
    "iconId": 78051,
    "typeId": 78
  },
  {
    "id": 1553,
    "name": {
      "es": "Runa Su Inte",
      "fr": "Rune Ra Ine",
      "en": "Ra Int Rune"
    },
    "level": 10,
    "iconId": 78039,
    "typeId": 78
  },
  {
    "id": 1554,
    "name": {
      "es": "Runa Su Vi",
      "fr": "Rune Ra Vi",
      "en": "Ra Vit Rune"
    },
    "level": 10,
    "iconId": 78054,
    "typeId": 78
  },
  {
    "id": 1555,
    "name": {
      "es": "Runa Su Agi",
      "fr": "Rune Ra Age",
      "en": "Ra Agi Rune"
    },
    "level": 10,
    "iconId": 78048,
    "typeId": 78
  },
  {
    "id": 1556,
    "name": {
      "es": "Runa Su Sue",
      "fr": "Rune Ra Cha",
      "en": "Ra Cha Rune"
    },
    "level": 10,
    "iconId": 78042,
    "typeId": 78
  },
  {
    "id": 1557,
    "name": {
      "es": "Runa Ga PA",
      "fr": "Rune Ga Pa",
      "en": "Ap Ga Rune"
    },
    "level": 100,
    "iconId": 78055,
    "typeId": 78
  },
  {
    "id": 1558,
    "name": {
      "es": "Runa Ga PM",
      "fr": "Rune Ga Pme",
      "en": "Mp Ga Rune"
    },
    "level": 95,
    "iconId": 78056,
    "typeId": 78
  },
  {
    "id": 7433,
    "name": {
      "es": "Runa Cri",
      "fr": "Rune Cri",
      "en": "Cri Rune"
    },
    "level": 80,
    "iconId": 78014,
    "typeId": 78
  },
  {
    "id": 7434,
    "name": {
      "es": "Runa Cu",
      "fr": "Rune So",
      "en": "Hea Rune"
    },
    "level": 80,
    "iconId": 78013,
    "typeId": 78
  },
  {
    "id": 7435,
    "name": {
      "es": "Runa Da",
      "fr": "Rune Do",
      "en": "Dam Rune"
    },
    "level": 50,
    "iconId": 78015,
    "typeId": 78
  },
  {
    "id": 7436,
    "name": {
      "es": "Runa Pot",
      "fr": "Rune Pui",
      "en": "Pow Rune"
    },
    "level": 15,
    "iconId": 78016,
    "typeId": 78
  },
  {
    "id": 7437,
    "name": {
      "es": "Runa Da Reen",
      "fr": "Rune Do Ren",
      "en": "Dam Ref Rune"
    },
    "level": 40,
    "iconId": 78017,
    "typeId": 78
  },
  {
    "id": 7438,
    "name": {
      "es": "Runa Al",
      "fr": "Rune Po",
      "en": "Range Rune"
    },
    "level": 90,
    "iconId": 78018,
    "typeId": 78
  },
  {
    "id": 7442,
    "name": {
      "es": "Runa Invo",
      "fr": "Rune Invo",
      "en": "Sum Rune"
    },
    "level": 85,
    "iconId": 78019,
    "typeId": 78
  },
  {
    "id": 7443,
    "name": {
      "es": "Runa Pod",
      "fr": "Rune Pod",
      "en": "Pod Rune"
    },
    "level": 1,
    "iconId": 78020,
    "typeId": 78
  },
  {
    "id": 7444,
    "name": {
      "es": "Runa Bu Pod",
      "fr": "Rune Pa Pod",
      "en": "Pa Pod Rune"
    },
    "level": 5,
    "iconId": 78021,
    "typeId": 78
  },
  {
    "id": 7445,
    "name": {
      "es": "Runa Su Pod",
      "fr": "Rune Ra Pod",
      "en": "Ra Pod Rune"
    },
    "level": 10,
    "iconId": 78022,
    "typeId": 78
  },
  {
    "id": 7446,
    "name": {
      "es": "Runa Da Tram",
      "fr": "Rune Do Pi",
      "en": "Trp Dam Rune"
    },
    "level": 40,
    "iconId": 78268,
    "typeId": 78
  },
  {
    "id": 7447,
    "name": {
      "es": "Runa Por Tram",
      "fr": "Rune Per Pi",
      "en": "Trp Per Rune"
    },
    "level": 15,
    "iconId": 78024,
    "typeId": 78
  },
  {
    "id": 7448,
    "name": {
      "es": "Runa Ini",
      "fr": "Rune Ini",
      "en": "Ini Rune"
    },
    "level": 1,
    "iconId": 78025,
    "typeId": 78
  },
  {
    "id": 7449,
    "name": {
      "es": "Runa Bu Ini",
      "fr": "Rune Pa Ini",
      "en": "Pa Ini Rune"
    },
    "level": 5,
    "iconId": 78026,
    "typeId": 78
  },
  {
    "id": 7450,
    "name": {
      "es": "Runa Su Ini",
      "fr": "Rune Ra Ini",
      "en": "Ra Ini Rune"
    },
    "level": 10,
    "iconId": 78027,
    "typeId": 78
  },
  {
    "id": 7451,
    "name": {
      "es": "Runa Prospe",
      "fr": "Rune Prospe",
      "en": "Pp Rune"
    },
    "level": 15,
    "iconId": 78036,
    "typeId": 78
  },
  {
    "id": 7452,
    "name": {
      "es": "Runa Re Fuego",
      "fr": "Rune Ré Feu",
      "en": "Fire Res Rune"
    },
    "level": 30,
    "iconId": 78028,
    "typeId": 78
  },
  {
    "id": 7453,
    "name": {
      "es": "Runa Re Aire",
      "fr": "Rune Ré Air",
      "en": "Air Res Rune"
    },
    "level": 30,
    "iconId": 78032,
    "typeId": 78
  },
  {
    "id": 7454,
    "name": {
      "es": "Runa Re Agua",
      "fr": "Rune Ré Eau",
      "en": "Water Res Rune"
    },
    "level": 30,
    "iconId": 78030,
    "typeId": 78
  },
  {
    "id": 7455,
    "name": {
      "es": "Runa Re Tierra",
      "fr": "Rune Ré Terre",
      "en": "Earth Res Rune"
    },
    "level": 30,
    "iconId": 78034,
    "typeId": 78
  },
  {
    "id": 7456,
    "name": {
      "es": "Runa Re Neutral",
      "fr": "Rune Ré Neutre",
      "en": "Neutral Res Rune"
    },
    "level": 30,
    "iconId": 78057,
    "typeId": 78
  },
  {
    "id": 7457,
    "name": {
      "es": "Runa Re Fuego Por",
      "fr": "Rune Ré Per Feu",
      "en": "Fire Res Per Rune"
    },
    "level": 75,
    "iconId": 78029,
    "typeId": 78
  },
  {
    "id": 7458,
    "name": {
      "es": "Runa Re Aire Por",
      "fr": "Rune Ré Per Air",
      "en": "Air Res Per Rune"
    },
    "level": 75,
    "iconId": 78033,
    "typeId": 78
  },
  {
    "id": 7459,
    "name": {
      "es": "Runa Re Tierra Por",
      "fr": "Rune Ré Per Terre",
      "en": "Earth Res Per Rune"
    },
    "level": 75,
    "iconId": 78035,
    "typeId": 78
  },
  {
    "id": 7460,
    "name": {
      "es": "Runa Re Neutral Por",
      "fr": "Rune Ré Per Neutre",
      "en": "Neutral Res Per Rune"
    },
    "level": 75,
    "iconId": 78058,
    "typeId": 78
  },
  {
    "id": 7508,
    "name": {
      "es": "Runa de firma",
      "fr": "Rune de Signature",
      "en": "Signature Rune"
    },
    "level": 100,
    "iconId": 50037,
    "typeId": 78
  },
  {
    "id": 7560,
    "name": {
      "es": "Runa Re Agua Por",
      "fr": "Rune Ré Per Eau",
      "en": "Water Res Per Rune"
    },
    "level": 75,
    "iconId": 78031,
    "typeId": 78
  },
  {
    "id": 10057,
    "name": {
      "es": "Runa de caza",
      "fr": "Rune de chasse",
      "en": "Hunting Rune"
    },
    "level": 10,
    "iconId": 78059,
    "typeId": 78
  },
  {
    "id": 10613,
    "name": {
      "es": "Runa Bu Da Tram",
      "fr": "Rune Pa Do Pi",
      "en": "Pa Trp Dam Rune"
    },
    "level": 45,
    "iconId": 78023,
    "typeId": 78
  },
  {
    "id": 10615,
    "name": {
      "es": "Runa Bu Por Tram",
      "fr": "Rune Pa Per Pi",
      "en": "Pa Trp Per Rune"
    },
    "level": 20,
    "iconId": 78266,
    "typeId": 78
  },
  {
    "id": 10616,
    "name": {
      "es": "Runa Su Por Tram",
      "fr": "Rune Ra Per Pi",
      "en": "Ra Trp Per Rune"
    },
    "level": 25,
    "iconId": 78267,
    "typeId": 78
  },
  {
    "id": 10618,
    "name": {
      "es": "Runa Bu Pot",
      "fr": "Rune Pa Pui",
      "en": "Pa Pow Rune"
    },
    "level": 20,
    "iconId": 78269,
    "typeId": 78
  },
  {
    "id": 10619,
    "name": {
      "es": "Runa Su Pot",
      "fr": "Rune Ra Pui",
      "en": "Ra Pow Rune"
    },
    "level": 25,
    "iconId": 78270,
    "typeId": 78
  },
  {
    "id": 10662,
    "name": {
      "es": "Runa Bu Prospe",
      "fr": "Rune Pa Prospe",
      "en": "Pa Pp Rune"
    },
    "level": 20,
    "iconId": 78271,
    "typeId": 78
  },
  {
    "id": 11637,
    "name": {
      "es": "Runa Hui",
      "fr": "Rune Fui",
      "en": "Dod Rune"
    },
    "level": 55,
    "iconId": 78076,
    "typeId": 78
  },
  {
    "id": 11638,
    "name": {
      "es": "Runa Bu Hui",
      "fr": "Rune Pa Fui",
      "en": "Pa Dod Rune"
    },
    "level": 60,
    "iconId": 78075,
    "typeId": 78
  },
  {
    "id": 11639,
    "name": {
      "es": "Runa Pla",
      "fr": "Rune Tac",
      "en": "Loc Rune"
    },
    "level": 55,
    "iconId": 78077,
    "typeId": 78
  },
  {
    "id": 11640,
    "name": {
      "es": "Runa Bu Pla",
      "fr": "Rune Pa Tac",
      "en": "Pa Loc Rune"
    },
    "level": 60,
    "iconId": 78078,
    "typeId": 78
  },
  {
    "id": 11641,
    "name": {
      "es": "Runa Re PA",
      "fr": "Rune Ré Pa",
      "en": "Ap Res Rune"
    },
    "level": 65,
    "iconId": 78083,
    "typeId": 78
  },
  {
    "id": 11642,
    "name": {
      "es": "Runa Bu Re PA",
      "fr": "Rune Pa Ré Pa",
      "en": "Pa Ap Res Rune"
    },
    "level": 70,
    "iconId": 78084,
    "typeId": 78
  },
  {
    "id": 11643,
    "name": {
      "es": "Runa Re PM",
      "fr": "Rune Ré Pme",
      "en": "Mp Res Rune"
    },
    "level": 65,
    "iconId": 78085,
    "typeId": 78
  },
  {
    "id": 11644,
    "name": {
      "es": "Runa Bu Re PM",
      "fr": "Rune Pa Ré Pme",
      "en": "Pa Mp Res Rune"
    },
    "level": 70,
    "iconId": 78086,
    "typeId": 78
  },
  {
    "id": 11645,
    "name": {
      "es": "Runa Ret PA",
      "fr": "Rune Ret Pa",
      "en": "Ap Red Rune"
    },
    "level": 65,
    "iconId": 78087,
    "typeId": 78
  },
  {
    "id": 11646,
    "name": {
      "es": "Runa Bu Ret PA",
      "fr": "Rune Pa Ret Pa",
      "en": "Pa Ap Red Rune"
    },
    "level": 70,
    "iconId": 78088,
    "typeId": 78
  },
  {
    "id": 11647,
    "name": {
      "es": "Runa Ret PM",
      "fr": "Rune Ret Pme",
      "en": "Mp Red Rune"
    },
    "level": 65,
    "iconId": 78089,
    "typeId": 78
  },
  {
    "id": 11648,
    "name": {
      "es": "Runa Bu Ret PM",
      "fr": "Rune Pa Ret Pme",
      "en": "Pa Mp Red Rune"
    },
    "level": 70,
    "iconId": 78090,
    "typeId": 78
  },
  {
    "id": 11649,
    "name": {
      "es": "Runa Da Emp",
      "fr": "Rune Do Pou",
      "en": "Psh Dam Rune"
    },
    "level": 40,
    "iconId": 78081,
    "typeId": 78
  },
  {
    "id": 11650,
    "name": {
      "es": "Runa Bu Da Emp",
      "fr": "Rune Pa Do Pou",
      "en": "Pa Psh Dam Rune"
    },
    "level": 45,
    "iconId": 78082,
    "typeId": 78
  },
  {
    "id": 11651,
    "name": {
      "es": "Runa Re Emp",
      "fr": "Rune Ré Pou",
      "en": "Psh Res Rune"
    },
    "level": 30,
    "iconId": 78079,
    "typeId": 78
  },
  {
    "id": 11652,
    "name": {
      "es": "Runa Bu Re Emp",
      "fr": "Rune Pa Ré Pou",
      "en": "Pa Psh Res Rune"
    },
    "level": 35,
    "iconId": 78080,
    "typeId": 78
  },
  {
    "id": 11653,
    "name": {
      "es": "Runa Da Cri",
      "fr": "Rune Do Cri",
      "en": "Cri Dam Rune"
    },
    "level": 40,
    "iconId": 78073,
    "typeId": 78
  },
  {
    "id": 11654,
    "name": {
      "es": "Runa Bu Da Cri",
      "fr": "Rune Pa Do Cri",
      "en": "Pa Cri Dam Rune"
    },
    "level": 45,
    "iconId": 78074,
    "typeId": 78
  },
  {
    "id": 11655,
    "name": {
      "es": "Runa Re Cri",
      "fr": "Rune Ré Cri",
      "en": "Cri Res Rune"
    },
    "level": 30,
    "iconId": 78071,
    "typeId": 78
  },
  {
    "id": 11656,
    "name": {
      "es": "Runa Bu Re Cri",
      "fr": "Rune Pa Ré Cri",
      "en": "Pa Cri Res Rune"
    },
    "level": 35,
    "iconId": 78072,
    "typeId": 78
  },
  {
    "id": 11657,
    "name": {
      "es": "Runa Da Tierra",
      "fr": "Rune Do Terre",
      "en": "Earth Dam Rune"
    },
    "level": 40,
    "iconId": 78065,
    "typeId": 78
  },
  {
    "id": 11658,
    "name": {
      "es": "Runa Bu Da Tierra",
      "fr": "Rune Pa Do Terre",
      "en": "Pa Earth Dam Rune"
    },
    "level": 45,
    "iconId": 78066,
    "typeId": 78
  },
  {
    "id": 11659,
    "name": {
      "es": "Runa Da Fuego",
      "fr": "Rune Do Feu",
      "en": "Fire Dam Rune"
    },
    "level": 40,
    "iconId": 78063,
    "typeId": 78
  },
  {
    "id": 11660,
    "name": {
      "es": "Runa Bu Da Fuego",
      "fr": "Rune Pa Do Feu",
      "en": "Pa Fire Dam Rune"
    },
    "level": 45,
    "iconId": 78064,
    "typeId": 78
  },
  {
    "id": 11661,
    "name": {
      "es": "Runa Da Agua",
      "fr": "Rune Do Eau",
      "en": "Water Dam Rune"
    },
    "level": 40,
    "iconId": 78061,
    "typeId": 78
  },
  {
    "id": 11662,
    "name": {
      "es": "Runa Bu Da Agua",
      "fr": "Rune Pa Do Eau",
      "en": "Pa Water Dam Rune"
    },
    "level": 45,
    "iconId": 78062,
    "typeId": 78
  },
  {
    "id": 11663,
    "name": {
      "es": "Runa Da Aire",
      "fr": "Rune Do Air",
      "en": "Air Dam Rune"
    },
    "level": 40,
    "iconId": 78067,
    "typeId": 78
  },
  {
    "id": 11664,
    "name": {
      "es": "Runa Bu Da Aire",
      "fr": "Rune Pa Do Air",
      "en": "Pa Air Dam Rune"
    },
    "level": 45,
    "iconId": 78068,
    "typeId": 78
  },
  {
    "id": 11665,
    "name": {
      "es": "Runa Da Neutral",
      "fr": "Rune Do Neutre",
      "en": "Neutral Dam Rune"
    },
    "level": 40,
    "iconId": 78069,
    "typeId": 78
  },
  {
    "id": 11666,
    "name": {
      "es": "Runa Bu Da Neutral",
      "fr": "Rune Pa Do Neutre",
      "en": "Pa Neutral Dam Rune"
    },
    "level": 45,
    "iconId": 78070,
    "typeId": 78
  },
  {
    "id": 18719,
    "name": {
      "es": "Runa Da Por CC",
      "fr": "Rune Do Per Mé",
      "en": "Mel Dam Per Rune"
    },
    "level": 50,
    "iconId": 78092,
    "typeId": 78
  },
  {
    "id": 18720,
    "name": {
      "es": "Runa Da Por Di",
      "fr": "Rune Do Per Di",
      "en": "Dis Dam Per Rune"
    },
    "level": 50,
    "iconId": 78091,
    "typeId": 78
  },
  {
    "id": 18721,
    "name": {
      "es": "Runa Da Por Ar",
      "fr": "Rune Do Per Ar",
      "en": "Wep Dam Per Rune"
    },
    "level": 50,
    "iconId": 78093,
    "typeId": 78
  },
  {
    "id": 18722,
    "name": {
      "es": "Runa Da Por He",
      "fr": "Rune Do Per So",
      "en": "Spe Dam Per Rune"
    },
    "level": 50,
    "iconId": 78094,
    "typeId": 78
  },
  {
    "id": 18723,
    "name": {
      "es": "Runa Re Por CC",
      "fr": "Rune Ré Per Mé",
      "en": "Mel Res Per Rune"
    },
    "level": 50,
    "iconId": 78095,
    "typeId": 78
  },
  {
    "id": 18724,
    "name": {
      "es": "Runa Re Por Di",
      "fr": "Rune Ré Per Di",
      "en": "Dis Res Per Rune"
    },
    "level": 50,
    "iconId": 78096,
    "typeId": 78
  },
  {
    "id": 19337,
    "name": {
      "es": "Runa Bu Cu",
      "fr": "Rune Pa So",
      "en": "Pa Hea Rune"
    },
    "level": 90,
    "iconId": 78099,
    "typeId": 78
  },
  {
    "id": 19338,
    "name": {
      "es": "Runa Bu Re Aire",
      "fr": "Rune Pa Ré Air",
      "en": "Pa Air Res Rune"
    },
    "level": 35,
    "iconId": 78100,
    "typeId": 78
  },
  {
    "id": 19339,
    "name": {
      "es": "Runa Bu Re Agua",
      "fr": "Rune Pa Ré Eau",
      "en": "Pa Water Res Rune"
    },
    "level": 35,
    "iconId": 78101,
    "typeId": 78
  },
  {
    "id": 19340,
    "name": {
      "es": "Runa Bu Re Fuego",
      "fr": "Rune Pa Ré Feu",
      "en": "Pa Fire Res Rune"
    },
    "level": 35,
    "iconId": 78102,
    "typeId": 78
  },
  {
    "id": 19341,
    "name": {
      "es": "Runa Bu Re Neutral",
      "fr": "Rune Pa Ré Neutre",
      "en": "Pa Neutral Res Rune"
    },
    "level": 35,
    "iconId": 78103,
    "typeId": 78
  },
  {
    "id": 19342,
    "name": {
      "es": "Runa Bu Re Tierra",
      "fr": "Rune Pa Ré Terre",
      "en": "Pa Earth Res Rune"
    },
    "level": 35,
    "iconId": 78104,
    "typeId": 78
  },
  {
    "id": 29683,
    "name": {
      "es": "Runa Su Re Emp",
      "fr": "Rune Ra Ré Pou",
      "en": "Ra Psh Res Rune"
    },
    "level": 40,
    "iconId": 78272,
    "typeId": 78
  },
  {
    "id": 29684,
    "name": {
      "es": "Runa Su Da Emp",
      "fr": "Rune Ra Do Pou",
      "en": "Ra Psh Dam Rune"
    },
    "level": 50,
    "iconId": 78273,
    "typeId": 78
  },
  {
    "id": 30695,
    "name": {
      "es": "Runa Su Re Tierra",
      "fr": "Rune Ra Ré Terre",
      "en": "Ra Earth Res Rune"
    },
    "level": 40,
    "iconId": 78294,
    "typeId": 78
  },
  {
    "id": 30696,
    "name": {
      "es": "Runa Su Re Neutral",
      "fr": "Rune Ra Ré Neutre",
      "en": "Ra Neutral Res Rune"
    },
    "level": 40,
    "iconId": 78293,
    "typeId": 78
  },
  {
    "id": 30697,
    "name": {
      "es": "Runa Su Re Fuego",
      "fr": "Rune Ra Ré Feu",
      "en": "Ra Fire Res Rune"
    },
    "level": 40,
    "iconId": 78295,
    "typeId": 78
  },
  {
    "id": 30698,
    "name": {
      "es": "Runa Su Re Agua",
      "fr": "Rune Ra Ré Eau",
      "en": "Ra Water Res Rune"
    },
    "level": 40,
    "iconId": 78296,
    "typeId": 78
  },
  {
    "id": 30699,
    "name": {
      "es": "Runa Su Re Cri",
      "fr": "Rune Ra Ré Cri",
      "en": "Ra Cri Res Rune"
    },
    "level": 40,
    "iconId": 78292,
    "typeId": 78
  },
  {
    "id": 30700,
    "name": {
      "es": "Runa Su Re Aire",
      "fr": "Rune Ra Ré Air",
      "en": "Ra Air Res Rune"
    },
    "level": 40,
    "iconId": 78297,
    "typeId": 78
  },
  {
    "id": 30942,
    "name": {
      "es": "Runa Bu Da Reen",
      "fr": "Rune Pa Do Ren",
      "en": "Pa Dam Ref Rune"
    },
    "level": 45,
    "iconId": 78017,
    "typeId": 78
  }
];

export const ALL_DOFUS_RUNES_DICT: Record<string, string> = {
  "1519": "Runa Fu",
  "1521": "Runa Sa",
  "1522": "Runa Inte",
  "1523": "Runa Vi",
  "1524": "Runa Agi",
  "1525": "Runa Sue",
  "1545": "Runa Bu Fu",
  "1546": "Runa Bu Sa",
  "1547": "Runa Bu Inte",
  "1548": "Runa Bu Vi",
  "1549": "Runa Bu Agi",
  "1550": "Runa Bu Sue",
  "1551": "Runa Su Fu",
  "1552": "Runa Su Sa",
  "1553": "Runa Su Inte",
  "1554": "Runa Su Vi",
  "1555": "Runa Su Agi",
  "1556": "Runa Su Sue",
  "1557": "Runa Ga PA",
  "1558": "Runa Ga PM",
  "7433": "Runa Cri",
  "7434": "Runa Cu",
  "7435": "Runa Da",
  "7436": "Runa Pot",
  "7437": "Runa Da Reen",
  "7438": "Runa Al",
  "7442": "Runa Invo",
  "7443": "Runa Pod",
  "7444": "Runa Bu Pod",
  "7445": "Runa Su Pod",
  "7446": "Runa Da Tram",
  "7447": "Runa Por Tram",
  "7448": "Runa Ini",
  "7449": "Runa Bu Ini",
  "7450": "Runa Su Ini",
  "7451": "Runa Prospe",
  "7452": "Runa Re Fuego",
  "7453": "Runa Re Aire",
  "7454": "Runa Re Agua",
  "7455": "Runa Re Tierra",
  "7456": "Runa Re Neutral",
  "7457": "Runa Re Fuego Por",
  "7458": "Runa Re Aire Por",
  "7459": "Runa Re Tierra Por",
  "7460": "Runa Re Neutral Por",
  "7508": "Runa de firma",
  "7560": "Runa Re Agua Por",
  "10057": "Runa de caza",
  "10613": "Runa Bu Da Tram",
  "10615": "Runa Bu Por Tram",
  "10616": "Runa Su Por Tram",
  "10618": "Runa Bu Pot",
  "10619": "Runa Su Pot",
  "10662": "Runa Bu Prospe",
  "11637": "Runa Hui",
  "11638": "Runa Bu Hui",
  "11639": "Runa Pla",
  "11640": "Runa Bu Pla",
  "11641": "Runa Re PA",
  "11642": "Runa Bu Re PA",
  "11643": "Runa Re PM",
  "11644": "Runa Bu Re PM",
  "11645": "Runa Ret PA",
  "11646": "Runa Bu Ret PA",
  "11647": "Runa Ret PM",
  "11648": "Runa Bu Ret PM",
  "11649": "Runa Da Emp",
  "11650": "Runa Bu Da Emp",
  "11651": "Runa Re Emp",
  "11652": "Runa Bu Re Emp",
  "11653": "Runa Da Cri",
  "11654": "Runa Bu Da Cri",
  "11655": "Runa Re Cri",
  "11656": "Runa Bu Re Cri",
  "11657": "Runa Da Tierra",
  "11658": "Runa Bu Da Tierra",
  "11659": "Runa Da Fuego",
  "11660": "Runa Bu Da Fuego",
  "11661": "Runa Da Agua",
  "11662": "Runa Bu Da Agua",
  "11663": "Runa Da Aire",
  "11664": "Runa Bu Da Aire",
  "11665": "Runa Da Neutral",
  "11666": "Runa Bu Da Neutral",
  "18719": "Runa Da Por CC",
  "18720": "Runa Da Por Di",
  "18721": "Runa Da Por Ar",
  "18722": "Runa Da Por He",
  "18723": "Runa Re Por CC",
  "18724": "Runa Re Por Di",
  "19337": "Runa Bu Cu",
  "19338": "Runa Bu Re Aire",
  "19339": "Runa Bu Re Agua",
  "19340": "Runa Bu Re Fuego",
  "19341": "Runa Bu Re Neutral",
  "19342": "Runa Bu Re Tierra",
  "29683": "Runa Su Re Emp",
  "29684": "Runa Su Da Emp",
  "30695": "Runa Su Re Tierra",
  "30696": "Runa Su Re Neutral",
  "30697": "Runa Su Re Fuego",
  "30698": "Runa Su Re Agua",
  "30699": "Runa Su Re Cri",
  "30700": "Runa Su Re Aire",
  "30942": "Runa Bu Da Reen"
};

export const ALL_DOFUS_RUNES_BY_ID: Record<number, DofusRuneItem> = Object.fromEntries(
  ALL_DOFUS_RUNES.map((r) => [r.id, r])
);
