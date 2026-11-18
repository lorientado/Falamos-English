import { EscapeStage } from '../types';

export const ESCAPE_SECRET_ITEM_ID = 'bookcase';
export const ESCAPE_SECRET_ROOM_ID = 'study';

export const ESCAPE_STAGES: EscapeStage[] = [
  {
    id: 'stage-hall',
    titleGl: '1. O recibidor misterioso',
    roomId: 'living_room',
    storyGl:
      'Uxía agochou o seu caderno secreto de inglés nalgún lugar da casa! Deixou 8 probas para quen coñeza os nomes das cousas en inglés. Comecemos polo salón.',
    clueFragmentGl: 'Pista 1: O lugar secreto NON está onde cociñamos nin onde durmimos.',
    steps: [
      {
        type: 'pick3d',
        promptGl: 'Preme no obxecto 3D onde sentan dúas ou tres persoas a ler no salón.',
        promptEn: 'Click the long soft seat in the living room!',
        targetId: 'sofa',
        hintsGl: [
          'É o asento grande e brando de cor cálida no centro do salón.',
          'Ten varios coxíns e está diante da mesiña baixa.',
        ],
      },
      {
        type: 'writeEn',
        promptGl: 'Como se di en inglés o obxecto iluminado que está marcado no salón?',
        targetIds: ['lamp'],
        hintsGl: [
          'Comeza por L e remata por P (4 letras).',
          'En galego é "lámpada": l _ m p.',
        ],
      },
    ],
  },
  {
    id: 'stage-living',
    titleGl: '2. Os detalles do salón',
    roomId: 'living_room',
    storyGl:
      'Debaixo dun moble apareceu unha nota en inglés con pistas sobre o salón.',
    clueFragmentGl: 'Pista 2: O caderno está nunha peza tranquila con mesa de traballo.',
    steps: [
      {
        type: 'definition',
        promptGl: 'Relaciona cada pista en inglés coa palabra correcta do salón:',
        items: [
          {
            clueEn: 'A soft piece of fabric on the floor under the table.',
            clueGl: 'Tecido brando no chan debaixo da mesiña.',
            targetId: 'rug',
          },
          {
            clueEn: 'Cloth hanging over the window to block light.',
            clueGl: 'Tea diante da ventá para tapar a luz.',
            targetId: 'curtains',
          },
        ],
        hintsGl: [
          'Pensa en "alfombra" (3 letras) e "cortinas" (en plural).',
          'As respostas son: rug / curtains.',
        ],
      },
    ],
  },
  {
    id: 'stage-bedroom',
    titleGl: '3. O cuarto dos soños',
    roomId: 'bedroom',
    storyGl:
      'Entramos no dormitorio! Aquí hai que identificar o léxico do descanso e da roupa.',
    clueFragmentGl: 'Pista 3: O acubillo secreto ten andeis cheos de historias.',
    steps: [
      {
        type: 'pick3d',
        promptGl: 'Preme no obxecto brando onde colocamos a cabeza para durmir.',
        promptEn: 'Find and click the soft cushion for your head on the bed!',
        targetId: 'pillow',
        hintsGl: [
          'Está enriba da cabeceira da cama.',
          'É branco e pequeno: o almofadón.',
        ],
      },
      {
        type: 'writeEn',
        promptGl: 'Escribe en inglés os dous mobles destacados do dormitorio:',
        targetIds: ['bed', 'wardrobe'],
        hintsGl: [
          'O primeiro ten 3 letras (cama) e o segundo comeza por W (armario).',
          'En inglés: bed e wardrobe.',
        ],
      },
    ],
  },
  {
    id: 'stage-kitchen',
    titleGl: '4. Sabores na cociña',
    roomId: 'kitchen',
    storyGl:
      'Unha nota pegada cun imán lévanos á cociña. Hai que abrir o frigorífico coas palabras exactas!',
    clueFragmentGl: 'Pista 4: O cuarto que buscas ten moita luz de lámpada para estudar.',
    steps: [
      {
        type: 'pick3d',
        promptGl: 'Preme no electrodoméstico frío da cociña onde gardamos o leite.',
        promptEn: 'Click the cold white appliance in the kitchen!',
        targetId: 'fridge',
        hintsGl: [
          'É o aparello alto e branco pegado á parede dereita da cociña.',
          'Ten dúas portas verticais.',
        ],
      },
      {
        type: 'roomName',
        promptGl: 'Como se chama en inglés esta habitación onde cociñamos?',
        targetRoomId: 'kitchen',
        hintsGl: [
          'Comeza por K e ten 7 letras.',
          'É "kitchen" (cociña).',
        ],
      },
    ],
  },
  {
    id: 'stage-bathroom',
    titleGl: '5. A proba da auga',
    roomId: 'bathroom',
    storyGl:
      'No baño hai mensaxes escribindo no bafo do espello!',
    clueFragmentGl: 'Pista 5: Non está no comedor nin no baño.',
    steps: [
      {
        type: 'definition',
        promptGl: 'Adiviña estas tres palabras do baño en inglés:',
        items: [
          {
            clueEn: 'Glass on the wall that shows your reflection.',
            clueGl: 'Reflicte a túa cara cando te peiteas.',
            targetId: 'mirror',
          },
          {
            clueEn: 'A basin with a tap to wash your hands.',
            clueGl: 'Pía con billa para lavar as mans.',
            targetId: 'sink',
          },
          {
            clueEn: 'Long tub you fill with warm water for a bath.',
            clueGl: 'Para darse un baño longo con escuma.',
            targetId: 'bathtub',
          },
        ],
        hintsGl: [
          'Lembra: espello (m...), lavabo (s...) e bañeira (b...).',
          'mirror, sink e bathtub.',
        ],
      },
    ],
  },
  {
    id: 'stage-sort',
    titleGl: '6. Ordenando a casa!',
    roomId: 'dining_room',
    storyGl:
      'Antes de entrar no último cuarto, temos que poñer orde nas pezas da casa.',
    clueFragmentGl: 'Pista 6: Busca un moble alto no que se gardan dicionarios e novelas.',
    steps: [
      {
        type: 'classify',
        promptGl: 'Coloca cada obxecto na súa habitación correcta en inglés:',
        items: [
          { itemId: 'dining_table', targetRoomId: 'dining_room' },
          { itemId: 'shower', targetRoomId: 'bathroom' },
          { itemId: 'stove', targetRoomId: 'kitchen' },
          { itemId: 'blanket', targetRoomId: 'bedroom' },
        ],
        hintsGl: [
          'Mesa de comedor → dining room; ducha → bathroom.',
          'Fogón → kitchen; manta → bedroom.',
        ],
      },
    ],
  },
  {
    id: 'stage-study',
    titleGl: '7. O recuncho dos deberes',
    roomId: 'study',
    storyGl:
      'Xa estamos moi preto! Chegamos ao espazo de traballo de Uxía.',
    clueFragmentGl: 'Pista 7: O caderno está entre os libros do moble de madeira do estudio!',
    steps: [
      {
        type: 'writeEn',
        promptGl: 'Escribe os nomes en inglés destes dous mobles do estudio:',
        targetIds: ['desk', 'chair'],
        hintsGl: [
          'Onde escribimos (d _ s k) e onde sentamos (c h _ _ r).',
          'desk e chair.',
        ],
      },
      {
        type: 'roomName',
        promptGl: 'Como se chama en inglés esta habitación de estudo?',
        targetRoomId: 'study',
        hintsGl: [
          'Parécese moito a "estudio" en galego: 5 letras, comeza por S.',
          'study.',
        ],
      },
    ],
  },
  {
    id: 'stage-final',
    titleGl: '8. O segredo final!',
    roomId: 'study',
    storyGl:
      'Tes todas as pistas! Abre o peche final indicando en inglés ONDE e EN QUE OBXECTO está agochado o caderno de Uxía.',
    clueFragmentGl: 'Segredo resolto!',
    steps: [
      {
        type: 'final',
        promptGl: 'Onde está o caderno secreto? Escolle o moble e a habitación en inglés:',
        targetItemId: ESCAPE_SECRET_ITEM_ID,
        targetRoomId: ESCAPE_SECRET_ROOM_ID,
        hintsGl: [
          'Revisa as pistas 6 e 7: un moble con andeis para libros no estudio.',
          'É a bookcase no study!',
        ],
      },
    ],
  },
];
