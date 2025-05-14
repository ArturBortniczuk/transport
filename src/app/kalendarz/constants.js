// Rozdzielone listy kierowców i pojazdów
export const KIEROWCY = [
    { id: 1, imie: "Dzianis Nestser", telefon: "885 560 083" },
    { id: 2, imie: "Wojciech Ostaszewski", telefon: "691 690 165" },
    { id: 3, imie: "Wojciech Ostaszewski", telefon: "691 690 165" },
    { id: 4, imie: "Krzysztof Sobolewski", telefon: "885 561 444" },
    { id: 5, imie: "Krzysztof Bauer", telefon: "693 880 149" },
    { id: 6, imie: "Paweł Stradomski", telefon: "885 560 557" }
];

export const POJAZDY = [
    { id: 1, tabliceRej: "BI 833JG", model: "MAN BIAŁYSTOK NOWY" },
    { id: 2, tabliceRej: "BI 25150", model: "BLASZAK RENAULT MASTER BIAŁYSTOK" },
    { id: 3, tabliceRej: "BI 23003", model: "FIRANKA RENAULT BIAŁYSTOK" },
    { id: 4, tabliceRej: "BI 61620", model: "MAN BIAŁYSTOK STARY" },
    { id: 5, tabliceRej: "BI 609EM", model: "MAN ZIELONKA" },
    { id: 6, tabliceRej: "BI 517GL", model: "CITROEN ZIELONKA" }
];
  
  export const RYNKI = [
    'Podlaski',
    'Mazowiecki',
    'Pomorski',
    'Lubelski',
    'Śląski',
    'Wielkopolski',
    'Małopolski',
    'Dolnośląski'
  ];
  
  export const POZIOMY_ZALADUNKU = [
    '25%',
    '50%',
    '75%',
    '100%'
  ];
  
  export const MAGAZYNY = {
    bialystok: { 
      lat: 53.1325, 
      lng: 23.1688, 
      nazwa: 'Magazyn Białystok',
      kolor: '#0000FF'  // czerwony dla Białegostoku
    },
    zielonka: { 
      lat: 52.3125, 
      lng: 21.1390, 
      nazwa: 'Magazyn Zielonka',
      kolor: '#FF0000'  // niebieski dla Zielonki
    }
  };
  
  export const getKierowcaColor = (kierowcaId) => {
    const kolory = {
      1: 'bg-red-100 border-red-300',
      2: 'bg-blue-100 border-blue-300',
      3: 'bg-green-100 border-green-300',
      4: 'bg-yellow-100 border-yellow-300',
      5: 'bg-purple-100 border-purple-300'
    };
    return kolory[kierowcaId] || 'bg-gray-100 border-gray-300';
  };
