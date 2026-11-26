/**
 * Elencos e técnicos reais (Séries A e B), de memória: referência do fim de 2025 / começo de 2026.
 * Pode ter jogador em clube errado, transferência faltando e técnico que já saiu: edite à vontade.
 *
 * Formato de cada jogador: "Nome;POSIÇÃO;ano de nascimento;nota".
 * A nota é RELATIVA dentro do clube (escala ~60 a 90): o jogo desloca o elenco inteiro para a força
 * que o clube tem no jogo. Elenco parcial é completado com jogadores gerados.
 */
export interface RealSquad {
  coach?: string;
  squad: string[];
}

export const REAL_SQUADS: Record<string, RealSquad> = {
  /* ------------------------------ Série A ------------------------------ */
  Flamengo: {
    coach: 'Filipe Luís',
    squad: [
      'Agustín Rossi;GOL;1995;80', 'Matheus Cunha;GOL;2001;70',
      'Guillermo Varela;DEF;1993;76', 'Emerson Royal;DEF;1999;76', 'Léo Ortiz;DEF;1996;80', 'Léo Pereira;DEF;1996;79', 'Danilo;DEF;1991;77',
      'Alex Sandro;DEF;1991;77', 'Ayrton Lucas;DEF;1997;75',
      'Erick Pulgar;MEI;1994;78', 'Jorginho;MEI;1991;80', 'Saúl Ñíguez;MEI;1994;78', 'Giorgian De Arrascaeta;MEI;1994;85', 'Jorge Carrascal;MEI;2001;78', 'Allan;MEI;1997;73',
      'Luiz Araújo;ATA;1996;78', 'Samuel Lino;ATA;1999;78', 'Everton Cebolinha;ATA;1996;75', 'Bruno Henrique;ATA;1990;77', 'Pedro;ATA;1997;82', 'Gonzalo Plata;ATA;2000;78',
      'Wallace Yan;ATA;2004;70',
    ],
  },
  Palmeiras: {
    coach: 'Abel Ferreira',
    squad: [
      'Weverton;GOL;1987;78', 'Carlos Miguel;GOL;1998;77',
      'Gustavo Gómez;DEF;1993;80', 'Murilo;DEF;1997;78', 'Bruno Fuchs;DEF;1999;76', 'Agustín Giay;DEF;2003;76', 'Khellven;DEF;2001;74', 'Joaquín Piquerez;DEF;1998;78',
      'Aníbal Moreno;MEI;1999;78', 'Emiliano Martínez;MEI;1999;76', 'Andreas Pereira;MEI;1996;79', 'Raphael Veiga;MEI;1995;80', 'Lucas Evangelista;MEI;1995;74', 'Maurício;MEI;2001;76',
      'Felipe Anderson;ATA;1993;78', 'Vitor Roque;ATA;2005;80', 'Flaco López;ATA;2000;79', 'Facundo Torres;ATA;2000;79', 'Ramón Sosa;ATA;1999;76', 'Paulinho;ATA;2000;77',
    ],
  },
  Corinthians: {
    coach: 'Dorival Júnior',
    squad: [
      'Hugo Souza;GOL;1999;78', 'Felipe Longo;GOL;2004;66',
      'Matheuzinho;DEF;2000;75', 'Félix Torres;DEF;1997;74', 'Gustavo Henrique;DEF;1993;75', 'André Ramalho;DEF;1992;75', 'Matheus Bidu;DEF;1999;73', 'Fabrizio Angileri;DEF;1994;73',
      'Raniele;MEI;1996;74', 'José Martínez;MEI;1994;75', 'Breno Bidon;MEI;2005;73', 'Rodrigo Garro;MEI;1997;79', 'André Carrillo;MEI;1991;75', 'Maycon;MEI;1997;75',
      'Memphis Depay;ATA;1994;82', 'Yuri Alberto;ATA;2001;78', 'Ángel Romero;ATA;1992;74', 'Talles Magno;ATA;2002;72', 'Gui Negão;ATA;2006;70',
    ],
  },
  'São Paulo': {
    coach: 'Hernán Crespo',
    squad: [
      'Rafael;GOL;1989;77', 'Jandrei;GOL;1993;70',
      'Robert Arboleda;DEF;1991;77', 'Alan Franco;DEF;1996;75', 'Sabino;DEF;1996;73', 'Rafael Tolói;DEF;1990;74', 'Cédric Soares;DEF;1991;73', 'Enzo Díaz;DEF;1996;74', 'Wendell;DEF;1993;74',
      'Pablo Maia;MEI;2002;77', 'Marcos Antônio;MEI;2000;75', 'Alisson;MEI;1993;74', 'Damián Bobadilla;MEI;1999;74', 'Oscar;MEI;1991;77',
      'Lucas Moura;ATA;1992;79', 'Luciano;ATA;1993;76', 'Jonathan Calleri;ATA;1993;78', 'Ferreirinha;ATA;1998;74', 'André Silva;ATA;1997;73',
    ],
  },
  'Atlético-MG': {
    coach: 'Jorge Sampaoli',
    squad: [
      'Everson;GOL;1990;78', 'Gabriel Delfim;GOL;2002;68',
      'Junior Alonso;DEF;1993;78', 'Lyanco;DEF;1997;75', 'Vitor Hugo;DEF;1991;74', 'Natanael;DEF;2002;73', 'Guilherme Arana;DEF;1997;79', 'Iván Román;DEF;2005;72',
      'Alan Franco;MEI;1998;75', 'Gustavo Scarpa;MEI;1994;79', 'Igor Gomes;MEI;1999;74', 'Fausto Vera;MEI;2000;75', 'Bernard;MEI;1992;76', 'Gabriel Menino;MEI;2000;74',
      'Hulk;ATA;1986;80', 'Rony;ATA;1995;76', 'Dudu;ATA;1992;76', 'Tomás Cuello;ATA;2000;75', 'Biel;ATA;2001;74',
    ],
  },
  Cruzeiro: {
    coach: 'Tite',
    squad: [
      'Cássio;GOL;1987;79', 'Léo Aragão;GOL;2002;68',
      'Fabrício Bruno;DEF;1996;79', 'Lucas Villalba;DEF;1994;75', 'Jonathan Jesus;DEF;1999;74', 'William;DEF;1995;75', 'Fagner;DEF;1989;74', 'Kaiki Bruno;DEF;2003;75',
      'Lucas Romero;MEI;1994;76', 'Lucas Silva;MEI;1993;75', 'Christian;MEI;2001;76', 'Walace;MEI;1995;76', 'Matheus Pereira;MEI;1996;82', 'Eduardo;MEI;1990;74',
      'Wanderson;ATA;1994;75', 'Kaio Jorge;ATA;2002;80', 'Gabigol;ATA;1996;77', 'Marquinhos;ATA;2003;72',
    ],
  },
  Grêmio: {
    coach: 'Luís Castro',
    squad: [
      'Tiago Volpi;GOL;1990;76', 'Gabriel Grando;GOL;2000;68',
      'Walter Kannemann;DEF;1991;75', 'Gustavo Martins;DEF;2003;73', 'Jemerson;DEF;1992;72', 'Wagner Leonardo;DEF;2000;72', 'Marlon;DEF;1997;73', 'João Pedro;DEF;1997;72',
      'Mathías Villasanti;MEI;1997;76', 'Dodi;MEI;1996;74', 'Edenílson;MEI;1989;73', 'Franco Cristaldo;MEI;1997;76', 'Arthur;MEI;1996;76',
      'Cristian Pavón;ATA;1996;76', 'Martin Braithwaite;ATA;1991;77', 'Francis Amuzu;ATA;1999;74', 'Carlos Vinícius;ATA;1995;75', 'Alysson;ATA;2006;70',
    ],
  },
  Internacional: {
    coach: 'Ramón Díaz',
    squad: [
      'Sergio Rochet;GOL;1993;79', 'Anthoni;GOL;2001;68',
      'Vitão;DEF;2000;76', 'Gabriel Mercado;DEF;1987;72', 'Juninho;DEF;1995;72', 'Alexandro Bernabei;DEF;2000;76', 'Braian Aguirre;DEF;2000;73',
      'Thiago Maia;MEI;1997;75', 'Fernando;MEI;1992;75', 'Bruno Henrique;MEI;1989;73', 'Alan Patrick;MEI;1991;79', 'Bruno Tabata;MEI;1997;74', 'Óscar Romero;MEI;1992;74',
      'Vitinho;ATA;1999;74', 'Rafael Borré;ATA;1995;78', 'Johan Carbonero;ATA;2000;75', 'Enner Valencia;ATA;1989;76', 'Ricardo Mathias;ATA;2004;70',
    ],
  },
  Fluminense: {
    coach: 'Luis Zubeldía',
    squad: [
      'Fábio;GOL;1980;75', 'Vitor Eudes;GOL;1999;66',
      'Thiago Silva;DEF;1984;78', 'Juan Pablo Freytes;DEF;2000;75', 'Ignácio;DEF;1997;74', 'Samuel Xavier;DEF;1990;73', 'Guga;DEF;1998;73', 'Renê;DEF;1992;72', 'Gabriel Fuentes;DEF;1997;73',
      'Martinelli;MEI;2001;76', 'Hércules;MEI;2001;75', 'Facundo Bernal;MEI;2003;74', 'Nonato;MEI;1998;74', 'Paulo Henrique Ganso;MEI;1989;75', 'Lucho Acosta;MEI;1994;78',
      'Agustín Canobbio;ATA;1998;76', 'Kevin Serna;ATA;1998;76', 'Germán Cano;ATA;1988;75', 'Everaldo;ATA;1991;73', 'Yeferson Soteldo;ATA;1997;75',
    ],
  },
  Botafogo: {
    coach: 'Davide Ancelotti',
    squad: [
      'John;GOL;1996;78', 'Léo Linck;GOL;2001;68',
      'Alexander Barboza;DEF;1995;77', 'Bastos;DEF;1991;76', 'David Ricardo;DEF;1999;72', 'Vitinho;DEF;1999;75', 'Alex Telles;DEF;1992;77', 'Cuiabano;DEF;2003;73',
      'Marlon Freitas;MEI;1995;77', 'Gregore;MEI;1994;76', 'Danilo Barbosa;MEI;1996;73', 'Allan;MEI;1991;73', 'Jefferson Savarino;MEI;1996;78', 'Álvaro Montoro;MEI;2003;74', 'Santiago Rodríguez;MEI;2000;75',
      'Artur;ATA;1998;76', 'Matheus Martins;ATA;2003;74', 'Joaquín Correa;ATA;1994;76', 'Arthur Cabral;ATA;1998;76', 'Jeffinho;ATA;1999;72',
    ],
  },
  'Vasco da Gama': {
    coach: 'Fernando Diniz',
    squad: [
      'Léo Jardim;GOL;1995;79', 'Daniel Fuzato;GOL;1997;68',
      'Robert Renan;DEF;2003;73', 'Carlos Cuesta;DEF;1997;74', 'Paulo Henrique;DEF;1996;74', 'Lucas Piton;DEF;2000;75', 'Puma Rodríguez;DEF;1999;74', 'Lucas Freitas;DEF;2004;71',
      'Hugo Moura;MEI;1997;74', 'Thiago Mendes;MEI;1992;74', 'Tchê Tchê;MEI;1992;74', 'Philippe Coutinho;MEI;1992;78', 'Matheus França;MEI;2004;73',
      'Nuno Moreira;ATA;1999;74', 'Pablo Vegetti;ATA;1988;77', 'Andrés Gómez;ATA;2002;73', 'David;ATA;1995;72',
    ],
  },
  Santos: {
    coach: 'Juan Pablo Vojvoda',
    squad: [
      'Gabriel Brazão;GOL;2000;76', 'Diógenes;GOL;2001;66',
      'Zé Ivaldo;DEF;1997;73', 'Luan Peres;DEF;1994;73', 'Adonis Frías;DEF;1998;73', 'Igor Vinícius;DEF;1997;72', 'Gonzalo Escobar;DEF;1997;71', 'Souza;DEF;2006;72',
      'João Schmidt;MEI;1993;73', 'Zé Rafael;MEI;1993;74', 'Tomás Rincón;MEI;1988;72', 'Benjamín Rollheiser;MEI;2000;74',
      'Neymar;ATA;1992;84', 'Guilherme;ATA;1995;74', 'Álvaro Barreal;ATA;2000;74', 'Tiquinho Soares;ATA;1991;74', 'Lautaro Díaz;ATA;1998;74', 'Robinho Jr.;ATA;2007;70',
    ],
  },
  Bahia: {
    coach: 'Rogério Ceni',
    squad: [
      'Marcos Felipe;GOL;1996;76', 'Ronaldo;GOL;1996;68',
      'Gilberto;DEF;1993;74', 'Kanu;DEF;1996;75', 'David Duarte;DEF;1995;73', 'Luciano Juba;DEF;1999;76', 'Santiago Arias;DEF;1992;74', 'Ramos Mingo;DEF;1999;72',
      'Caio Alexandre;MEI;1999;76', 'Jean Lucas;MEI;1998;77', 'Rodrigo Nestor;MEI;2000;74', 'Everton Ribeiro;MEI;1989;76', 'Cauly;MEI;1995;75', 'Michel Araújo;MEI;1996;74',
      'Erick Pulga;ATA;2000;74', 'Ademir;ATA;1995;73', 'Willian José;ATA;1991;75', 'Lucho Rodríguez;ATA;2004;73',
    ],
  },
  'Athletico-PR': {
    coach: 'Odair Hellmann',
    squad: [
      'Mycael;GOL;2004;72',
      'Thiago Heleno;DEF;1988;72', 'Esquivel;DEF;1998;72',
      'Bruno Zapelli;MEI;2002;73', 'Felipinho;MEI;2004;70',
      'Kevin Viveros;ATA;1998;74', 'Luiz Fernando;ATA;1996;72', 'Steven Mendoza;ATA;1999;72',
    ],
  },
  'Red Bull Bragantino': {
    coach: 'Vagner Mancini',
    squad: [
      'Cleiton;GOL;1997;76',
      'Pedro Henrique;DEF;1995;74', 'Gustavo Marques;DEF;2003;72', 'Juninho Capixaba;DEF;1997;74', 'Andrés Hurtado;DEF;2003;72',
      'Jhon Jhon;MEI;2002;75', 'Eric Ramires;MEI;1997;73',
      'Isidro Pitta;ATA;1999;76', 'Eduardo Sasha;ATA;1992;73', 'Lucas Barbosa;ATA;2000;73', 'Vinicinho;ATA;2000;73',
    ],
  },
  Coritiba: {
    coach: 'Mozart',
    squad: [
      'Pedro Morisco;GOL;2004;72',
      'Maicon;DEF;1988;72',
      'Sebastián Gómez;MEI;1996;74', 'Josué;MEI;1990;73',
      'Lucas Ronier;ATA;2005;72', 'Clayson;ATA;1995;71', 'Gustavo Coutinho;ATA;1999;72',
    ],
  },
  Vitória: {
    coach: 'Jair Ventura',
    squad: [
      'Lucas Arcanjo;GOL;1999;74',
      'Neris;DEF;1990;72', 'Lucas Halter;DEF;2000;72', 'Raúl Cáceres;DEF;1991;71',
      'Baralhas;MEI;1998;72', 'Matheuzinho;MEI;2000;73',
      'Renato Kayzer;ATA;1995;73', 'Osvaldo;ATA;1987;71',
    ],
  },
  Mirassol: {
    coach: 'Rafael Guanaes',
    squad: [
      'Walter;GOL;1987;74',
      'Jemmes;DEF;1996;72', 'Reinaldo;DEF;1989;75', 'Lucas Ramon;DEF;1993;72',
      'Danielzinho;MEI;1997;74', 'Neto Moura;MEI;1997;73',
      'Chico da Costa;ATA;1998;73', 'Negueba;ATA;1998;73', 'Iury Castilho;ATA;1995;72',
    ],
  },
  Chapecoense: {
    coach: 'Gilmar Dal Pozzo',
    squad: ['Léo Vieira;GOL;1993;70', 'Giovanni Augusto;MEI;1989;72', 'Marcinho;ATA;1995;71'],
  },
  Remo: {
    coach: 'Guto Ferreira',
    squad: ['Marcelo Rangel;GOL;1988;72', 'Pedro Rocha;ATA;1994;72', 'Janderson;ATA;1999;71'],
  },

  /* ------------------------------ Série B (só quem eu conheço bem) ------------------------------ */
  Fortaleza: {
    coach: 'Martín Palermo',
    squad: [
      'João Ricardo;GOL;1988;74',
      'Emanuel Brítez;DEF;1994;74', 'Benjamín Kuscevic;DEF;1996;73', 'Titi;DEF;1988;72', 'Bruno Pacheco;DEF;1991;72',
      'Tomás Pochettino;MEI;1996;75', 'Lucas Sasha;MEI;1990;72', 'Pol Fernández;MEI;1991;74',
      'Breno Lopes;ATA;1996;73', 'Juan Martín Lucero;ATA;1992;75', 'Moisés;ATA;1995;73', 'Marinho;ATA;1990;72',
    ],
  },
  Sport: {
    squad: ['Rafael Thyere;DEF;1993;71', 'Lucas Lima;MEI;1990;73', 'Gonçalo Paciência;ATA;1994;72', 'Derik Lacerda;ATA;1999;71'],
  },
  Ceará: {
    coach: 'Léo Condé',
    squad: ['Fernando Sobral;MEI;1994;72', 'Pedro Raul;ATA;1996;74', 'Aylon;ATA;1998;71'],
  },
  Juventude: {
    coach: 'Thiago Carpini',
    squad: [],
  },
};
