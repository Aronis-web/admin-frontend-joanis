/**
 * Ubigeo del Perú - Departamentos, Provincias y Distritos
 * Datos oficiales del INEI (Instituto Nacional de Estadística e Informática)
 */

export interface Distrito {
  codigo: string;
  nombre: string;
}

export interface Provincia {
  codigo: string;
  nombre: string;
  distritos: Distrito[];
}

export interface Departamento {
  codigo: string;
  nombre: string;
  provincias: Provincia[];
}

export const UBIGEO_PERU: Departamento[] = [
  {
    codigo: '01',
    nombre: 'Amazonas',
    provincias: [
      {
        codigo: '0101',
        nombre: 'Chachapoyas',
        distritos: [
          { codigo: '010101', nombre: 'Chachapoyas' },
          { codigo: '010102', nombre: 'Asunción' },
          { codigo: '010103', nombre: 'Balsas' },
          { codigo: '010104', nombre: 'Cheto' },
          { codigo: '010105', nombre: 'Chiliquin' },
          { codigo: '010106', nombre: 'Chuquibamba' },
          { codigo: '010107', nombre: 'Granada' },
          { codigo: '010108', nombre: 'Huancas' },
          { codigo: '010109', nombre: 'La Jalca' },
          { codigo: '010110', nombre: 'Leimebamba' },
          { codigo: '010111', nombre: 'Levanto' },
          { codigo: '010112', nombre: 'Magdalena' },
          { codigo: '010113', nombre: 'Mariscal Castilla' },
          { codigo: '010114', nombre: 'Molinopampa' },
          { codigo: '010115', nombre: 'Montevideo' },
          { codigo: '010116', nombre: 'Olleros' },
          { codigo: '010117', nombre: 'Quinjalca' },
          { codigo: '010118', nombre: 'San Francisco de Daguas' },
          { codigo: '010119', nombre: 'San Isidro de Maino' },
          { codigo: '010120', nombre: 'Soloco' },
          { codigo: '010121', nombre: 'Sonche' },
        ],
      },
      {
        codigo: '0102',
        nombre: 'Bagua',
        distritos: [
          { codigo: '010201', nombre: 'Bagua' },
          { codigo: '010202', nombre: 'Aramango' },
          { codigo: '010203', nombre: 'Copallin' },
          { codigo: '010204', nombre: 'El Parco' },
          { codigo: '010205', nombre: 'Imaza' },
          { codigo: '010206', nombre: 'La Peca' },
        ],
      },
    ],
  },
  {
    codigo: '02',
    nombre: 'Áncash',
    provincias: [
      {
        codigo: '0201',
        nombre: 'Huaraz',
        distritos: [
          { codigo: '020101', nombre: 'Huaraz' },
          { codigo: '020102', nombre: 'Cochabamba' },
          { codigo: '020103', nombre: 'Colcabamba' },
          { codigo: '020104', nombre: 'Huanchay' },
          { codigo: '020105', nombre: 'Independencia' },
          { codigo: '020106', nombre: 'Jangas' },
          { codigo: '020107', nombre: 'La Libertad' },
          { codigo: '020108', nombre: 'Olleros' },
          { codigo: '020109', nombre: 'Pampas Grande' },
          { codigo: '020110', nombre: 'Pariacoto' },
          { codigo: '020111', nombre: 'Pira' },
          { codigo: '020112', nombre: 'Tarica' },
        ],
      },
    ],
  },
  {
    codigo: '03',
    nombre: 'Apurímac',
    provincias: [
      {
        codigo: '0301',
        nombre: 'Abancay',
        distritos: [
          { codigo: '030101', nombre: 'Abancay' },
          { codigo: '030102', nombre: 'Chacoche' },
          { codigo: '030103', nombre: 'Circa' },
          { codigo: '030104', nombre: 'Curahuasi' },
          { codigo: '030105', nombre: 'Huanipaca' },
          { codigo: '030106', nombre: 'Lambrama' },
          { codigo: '030107', nombre: 'Pichirhua' },
          { codigo: '030108', nombre: 'San Pedro de Cachora' },
          { codigo: '030109', nombre: 'Tamburco' },
        ],
      },
    ],
  },
  {
    codigo: '04',
    nombre: 'Arequipa',
    provincias: [
      {
        codigo: '0401',
        nombre: 'Arequipa',
        distritos: [
          { codigo: '040101', nombre: 'Arequipa' },
          { codigo: '040102', nombre: 'Alto Selva Alegre' },
          { codigo: '040103', nombre: 'Cayma' },
          { codigo: '040104', nombre: 'Cerro Colorado' },
          { codigo: '040105', nombre: 'Characato' },
          { codigo: '040106', nombre: 'Chiguata' },
          { codigo: '040107', nombre: 'Jacobo Hunter' },
          { codigo: '040108', nombre: 'La Joya' },
          { codigo: '040109', nombre: 'Mariano Melgar' },
          { codigo: '040110', nombre: 'Miraflores' },
          { codigo: '040111', nombre: 'Mollebaya' },
          { codigo: '040112', nombre: 'Paucarpata' },
          { codigo: '040113', nombre: 'Pocsi' },
          { codigo: '040114', nombre: 'Polobaya' },
          { codigo: '040115', nombre: 'Quequeña' },
          { codigo: '040116', nombre: 'Sabandia' },
          { codigo: '040117', nombre: 'Sachaca' },
          { codigo: '040118', nombre: 'San Juan de Siguas' },
          { codigo: '040119', nombre: 'San Juan de Tarucani' },
          { codigo: '040120', nombre: 'Santa Isabel de Siguas' },
          { codigo: '040121', nombre: 'Santa Rita de Siguas' },
          { codigo: '040122', nombre: 'Socabaya' },
          { codigo: '040123', nombre: 'Tiabaya' },
          { codigo: '040124', nombre: 'Uchumayo' },
          { codigo: '040125', nombre: 'Vitor' },
          { codigo: '040126', nombre: 'Yanahuara' },
          { codigo: '040127', nombre: 'Yarabamba' },
          { codigo: '040128', nombre: 'Yura' },
          { codigo: '040129', nombre: 'José Luis Bustamante y Rivero' },
        ],
      },
    ],
  },
  {
    codigo: '05',
    nombre: 'Ayacucho',
    provincias: [
      {
        codigo: '0501',
        nombre: 'Huamanga',
        distritos: [
          { codigo: '050101', nombre: 'Ayacucho' },
          { codigo: '050102', nombre: 'Acocro' },
          { codigo: '050103', nombre: 'Acos Vinchos' },
          { codigo: '050104', nombre: 'Carmen Alto' },
          { codigo: '050105', nombre: 'Chiara' },
          { codigo: '050106', nombre: 'Ocros' },
          { codigo: '050107', nombre: 'Pacaycasa' },
          { codigo: '050108', nombre: 'Quinua' },
          { codigo: '050109', nombre: 'San José de Ticllas' },
          { codigo: '050110', nombre: 'San Juan Bautista' },
          { codigo: '050111', nombre: 'Santiago de Pischa' },
          { codigo: '050112', nombre: 'Socos' },
          { codigo: '050113', nombre: 'Tambillo' },
          { codigo: '050114', nombre: 'Vinchos' },
          { codigo: '050115', nombre: 'Jesús Nazareno' },
        ],
      },
    ],
  },
  {
    codigo: '06',
    nombre: 'Cajamarca',
    provincias: [
      {
        codigo: '0601',
        nombre: 'Cajamarca',
        distritos: [
          { codigo: '060101', nombre: 'Cajamarca' },
          { codigo: '060102', nombre: 'Asunción' },
          { codigo: '060103', nombre: 'Chetilla' },
          { codigo: '060104', nombre: 'Cospan' },
          { codigo: '060105', nombre: 'Encañada' },
          { codigo: '060106', nombre: 'Jesús' },
          { codigo: '060107', nombre: 'Llacanora' },
          { codigo: '060108', nombre: 'Los Baños del Inca' },
          { codigo: '060109', nombre: 'Magdalena' },
          { codigo: '060110', nombre: 'Matara' },
          { codigo: '060111', nombre: 'Namora' },
          { codigo: '060112', nombre: 'San Juan' },
        ],
      },
    ],
  },
  {
    codigo: '07',
    nombre: 'Callao',
    provincias: [
      {
        codigo: '0701',
        nombre: 'Callao',
        distritos: [
          { codigo: '070101', nombre: 'Callao' },
          { codigo: '070102', nombre: 'Bellavista' },
          { codigo: '070103', nombre: 'Carmen de la Legua Reynoso' },
          { codigo: '070104', nombre: 'La Perla' },
          { codigo: '070105', nombre: 'La Punta' },
          { codigo: '070106', nombre: 'Ventanilla' },
          { codigo: '070107', nombre: 'Mi Perú' },
        ],
      },
    ],
  },
  {
    codigo: '08',
    nombre: 'Cusco',
    provincias: [
      {
        codigo: '0801',
        nombre: 'Cusco',
        distritos: [
          { codigo: '080101', nombre: 'Cusco' },
          { codigo: '080102', nombre: 'Ccorca' },
          { codigo: '080103', nombre: 'Poroy' },
          { codigo: '080104', nombre: 'San Jerónimo' },
          { codigo: '080105', nombre: 'San Sebastián' },
          { codigo: '080106', nombre: 'Santiago' },
          { codigo: '080107', nombre: 'Saylla' },
          { codigo: '080108', nombre: 'Wanchaq' },
        ],
      },
    ],
  },
  {
    codigo: '09',
    nombre: 'Huancavelica',
    provincias: [
      {
        codigo: '0901',
        nombre: 'Huancavelica',
        distritos: [
          { codigo: '090101', nombre: 'Huancavelica' },
          { codigo: '090102', nombre: 'Acobambilla' },
          { codigo: '090103', nombre: 'Acoria' },
          { codigo: '090104', nombre: 'Conayca' },
          { codigo: '090105', nombre: 'Cuenca' },
          { codigo: '090106', nombre: 'Huachocolpa' },
          { codigo: '090107', nombre: 'Huayllahuara' },
          { codigo: '090108', nombre: 'Izcuchaca' },
          { codigo: '090109', nombre: 'Laria' },
          { codigo: '090110', nombre: 'Manta' },
          { codigo: '090111', nombre: 'Mariscal Cáceres' },
          { codigo: '090112', nombre: 'Moya' },
          { codigo: '090113', nombre: 'Nuevo Occoro' },
          { codigo: '090114', nombre: 'Palca' },
          { codigo: '090115', nombre: 'Pilchaca' },
          { codigo: '090116', nombre: 'Vilca' },
          { codigo: '090117', nombre: 'Yauli' },
          { codigo: '090118', nombre: 'Ascensión' },
          { codigo: '090119', nombre: 'Huando' },
        ],
      },
    ],
  },
  {
    codigo: '10',
    nombre: 'Huánuco',
    provincias: [
      {
        codigo: '1001',
        nombre: 'Huánuco',
        distritos: [
          { codigo: '100101', nombre: 'Huánuco' },
          { codigo: '100102', nombre: 'Amarilis' },
          { codigo: '100103', nombre: 'Chinchao' },
          { codigo: '100104', nombre: 'Churubamba' },
          { codigo: '100105', nombre: 'Margos' },
          { codigo: '100106', nombre: 'Quisqui (Kichki)' },
          { codigo: '100107', nombre: 'San Francisco de Cayran' },
          { codigo: '100108', nombre: 'San Pedro de Chaulan' },
          { codigo: '100109', nombre: 'Santa María del Valle' },
          { codigo: '100110', nombre: 'Yarumayo' },
          { codigo: '100111', nombre: 'Pillco Marca' },
          { codigo: '100112', nombre: 'Yacus' },
          { codigo: '100113', nombre: 'San Pablo de Pillao' },
        ],
      },
    ],
  },
  {
    codigo: '11',
    nombre: 'Ica',
    provincias: [
      {
        codigo: '1101',
        nombre: 'Ica',
        distritos: [
          { codigo: '110101', nombre: 'Ica' },
          { codigo: '110102', nombre: 'La Tinguiña' },
          { codigo: '110103', nombre: 'Los Aquijes' },
          { codigo: '110104', nombre: 'Ocucaje' },
          { codigo: '110105', nombre: 'Pachacutec' },
          { codigo: '110106', nombre: 'Parcona' },
          { codigo: '110107', nombre: 'Pueblo Nuevo' },
          { codigo: '110108', nombre: 'Salas' },
          { codigo: '110109', nombre: 'San José de Los Molinos' },
          { codigo: '110110', nombre: 'San Juan Bautista' },
          { codigo: '110111', nombre: 'Santiago' },
          { codigo: '110112', nombre: 'Subtanjalla' },
          { codigo: '110113', nombre: 'Tate' },
          { codigo: '110114', nombre: 'Yauca del Rosario' },
        ],
      },
    ],
  },
  {
    codigo: '12',
    nombre: 'Junín',
    provincias: [
      {
        codigo: '1201',
        nombre: 'Huancayo',
        distritos: [
          { codigo: '120101', nombre: 'Huancayo' },
          { codigo: '120104', nombre: 'Carhuacallanga' },
          { codigo: '120105', nombre: 'Chacapampa' },
          { codigo: '120106', nombre: 'Chicche' },
          { codigo: '120107', nombre: 'Chilca' },
          { codigo: '120108', nombre: 'Chongos Alto' },
          { codigo: '120111', nombre: 'Chupuro' },
          { codigo: '120112', nombre: 'Colca' },
          { codigo: '120113', nombre: 'Cullhuas' },
          { codigo: '120114', nombre: 'El Tambo' },
          { codigo: '120116', nombre: 'Huacrapuquio' },
          { codigo: '120117', nombre: 'Hualhuas' },
          { codigo: '120119', nombre: 'Huancan' },
          { codigo: '120120', nombre: 'Huasicancha' },
          { codigo: '120121', nombre: 'Huayucachi' },
          { codigo: '120122', nombre: 'Ingenio' },
          { codigo: '120124', nombre: 'Pariahuanca' },
          { codigo: '120125', nombre: 'Pilcomayo' },
          { codigo: '120126', nombre: 'Pucara' },
          { codigo: '120127', nombre: 'Quichuay' },
          { codigo: '120128', nombre: 'Quilcas' },
          { codigo: '120129', nombre: 'San Agustín' },
          { codigo: '120130', nombre: 'San Jerónimo de Tunan' },
          { codigo: '120132', nombre: 'Saño' },
          { codigo: '120133', nombre: 'Sapallanga' },
          { codigo: '120134', nombre: 'Sicaya' },
          { codigo: '120135', nombre: 'Santo Domingo de Acobamba' },
          { codigo: '120136', nombre: 'Viques' },
        ],
      },
    ],
  },
  {
    codigo: '13',
    nombre: 'La Libertad',
    provincias: [
      {
        codigo: '1301',
        nombre: 'Trujillo',
        distritos: [
          { codigo: '130101', nombre: 'Trujillo' },
          { codigo: '130102', nombre: 'El Porvenir' },
          { codigo: '130103', nombre: 'Florencia de Mora' },
          { codigo: '130104', nombre: 'Huanchaco' },
          { codigo: '130105', nombre: 'La Esperanza' },
          { codigo: '130106', nombre: 'Laredo' },
          { codigo: '130107', nombre: 'Moche' },
          { codigo: '130108', nombre: 'Poroto' },
          { codigo: '130109', nombre: 'Salaverry' },
          { codigo: '130110', nombre: 'Simbal' },
          { codigo: '130111', nombre: 'Victor Larco Herrera' },
        ],
      },
    ],
  },
  {
    codigo: '14',
    nombre: 'Lambayeque',
    provincias: [
      {
        codigo: '1401',
        nombre: 'Chiclayo',
        distritos: [
          { codigo: '140101', nombre: 'Chiclayo' },
          { codigo: '140102', nombre: 'Chongoyape' },
          { codigo: '140103', nombre: 'Eten' },
          { codigo: '140104', nombre: 'Eten Puerto' },
          { codigo: '140105', nombre: 'José Leonardo Ortiz' },
          { codigo: '140106', nombre: 'La Victoria' },
          { codigo: '140107', nombre: 'Lagunas' },
          { codigo: '140108', nombre: 'Monsefu' },
          { codigo: '140109', nombre: 'Nueva Arica' },
          { codigo: '140110', nombre: 'Oyotun' },
          { codigo: '140111', nombre: 'Picsi' },
          { codigo: '140112', nombre: 'Pimentel' },
          { codigo: '140113', nombre: 'Reque' },
          { codigo: '140114', nombre: 'Santa Rosa' },
          { codigo: '140115', nombre: 'Saña' },
          { codigo: '140116', nombre: 'Cayalti' },
          { codigo: '140117', nombre: 'Patapo' },
          { codigo: '140118', nombre: 'Pomalca' },
          { codigo: '140119', nombre: 'Pucala' },
          { codigo: '140120', nombre: 'Tuman' },
        ],
      },
    ],
  },
  {
    codigo: '15',
    nombre: 'Lima',
    provincias: [
      {
        codigo: '1501',
        nombre: 'Lima',
        distritos: [
          { codigo: '150101', nombre: 'Lima' },
          { codigo: '150102', nombre: 'Ancón' },
          { codigo: '150103', nombre: 'Ate' },
          { codigo: '150104', nombre: 'Barranco' },
          { codigo: '150105', nombre: 'Breña' },
          { codigo: '150106', nombre: 'Carabayllo' },
          { codigo: '150107', nombre: 'Chaclacayo' },
          { codigo: '150108', nombre: 'Chorrillos' },
          { codigo: '150109', nombre: 'Cieneguilla' },
          { codigo: '150110', nombre: 'Comas' },
          { codigo: '150111', nombre: 'El Agustino' },
          { codigo: '150112', nombre: 'Independencia' },
          { codigo: '150113', nombre: 'Jesús María' },
          { codigo: '150114', nombre: 'La Molina' },
          { codigo: '150115', nombre: 'La Victoria' },
          { codigo: '150116', nombre: 'Lince' },
          { codigo: '150117', nombre: 'Los Olivos' },
          { codigo: '150118', nombre: 'Lurigancho' },
          { codigo: '150119', nombre: 'Lurin' },
          { codigo: '150120', nombre: 'Magdalena del Mar' },
          { codigo: '150121', nombre: 'Pueblo Libre' },
          { codigo: '150122', nombre: 'Miraflores' },
          { codigo: '150123', nombre: 'Pachacamac' },
          { codigo: '150124', nombre: 'Pucusana' },
          { codigo: '150125', nombre: 'Puente Piedra' },
          { codigo: '150126', nombre: 'Punta Hermosa' },
          { codigo: '150127', nombre: 'Punta Negra' },
          { codigo: '150128', nombre: 'Rímac' },
          { codigo: '150129', nombre: 'San Bartolo' },
          { codigo: '150130', nombre: 'San Borja' },
          { codigo: '150131', nombre: 'San Isidro' },
          { codigo: '150132', nombre: 'San Juan de Lurigancho' },
          { codigo: '150133', nombre: 'San Juan de Miraflores' },
          { codigo: '150134', nombre: 'San Luis' },
          { codigo: '150135', nombre: 'San Martín de Porres' },
          { codigo: '150136', nombre: 'San Miguel' },
          { codigo: '150137', nombre: 'Santa Anita' },
          { codigo: '150138', nombre: 'Santa María del Mar' },
          { codigo: '150139', nombre: 'Santa Rosa' },
          { codigo: '150140', nombre: 'Santiago de Surco' },
          { codigo: '150141', nombre: 'Surquillo' },
          { codigo: '150142', nombre: 'Villa El Salvador' },
          { codigo: '150143', nombre: 'Villa María del Triunfo' },
        ],
      },
    ],
  },
  {
    codigo: '16',
    nombre: 'Loreto',
    provincias: [
      {
        codigo: '1601',
        nombre: 'Maynas',
        distritos: [
          { codigo: '160101', nombre: 'Iquitos' },
          { codigo: '160102', nombre: 'Alto Nanay' },
          { codigo: '160103', nombre: 'Fernando Lores' },
          { codigo: '160104', nombre: 'Indiana' },
          { codigo: '160105', nombre: 'Las Amazonas' },
          { codigo: '160106', nombre: 'Mazan' },
          { codigo: '160107', nombre: 'Napo' },
          { codigo: '160108', nombre: 'Punchana' },
          { codigo: '160110', nombre: 'Torres Causana' },
          { codigo: '160112', nombre: 'Belén' },
          { codigo: '160113', nombre: 'San Juan Bautista' },
        ],
      },
    ],
  },
  {
    codigo: '17',
    nombre: 'Madre de Dios',
    provincias: [
      {
        codigo: '1701',
        nombre: 'Tambopata',
        distritos: [
          { codigo: '170101', nombre: 'Tambopata' },
          { codigo: '170102', nombre: 'Inambari' },
          { codigo: '170103', nombre: 'Las Piedras' },
          { codigo: '170104', nombre: 'Laberinto' },
        ],
      },
    ],
  },
  {
    codigo: '18',
    nombre: 'Moquegua',
    provincias: [
      {
        codigo: '1801',
        nombre: 'Mariscal Nieto',
        distritos: [
          { codigo: '180101', nombre: 'Moquegua' },
          { codigo: '180102', nombre: 'Carumas' },
          { codigo: '180103', nombre: 'Cuchumbaya' },
          { codigo: '180104', nombre: 'Samegua' },
          { codigo: '180105', nombre: 'San Cristóbal' },
          { codigo: '180106', nombre: 'Torata' },
        ],
      },
    ],
  },
  {
    codigo: '19',
    nombre: 'Pasco',
    provincias: [
      {
        codigo: '1901',
        nombre: 'Pasco',
        distritos: [
          { codigo: '190101', nombre: 'Chaupimarca' },
          { codigo: '190102', nombre: 'Huachon' },
          { codigo: '190103', nombre: 'Huariaca' },
          { codigo: '190104', nombre: 'Huayllay' },
          { codigo: '190105', nombre: 'Ninacaca' },
          { codigo: '190106', nombre: 'Pallanchacra' },
          { codigo: '190107', nombre: 'Paucartambo' },
          { codigo: '190108', nombre: 'San Francisco de Asís de Yarusyacan' },
          { codigo: '190109', nombre: 'Simon Bolívar' },
          { codigo: '190110', nombre: 'Ticlacayan' },
          { codigo: '190111', nombre: 'Tinyahuarco' },
          { codigo: '190112', nombre: 'Vicco' },
          { codigo: '190113', nombre: 'Yanacancha' },
        ],
      },
    ],
  },
  {
    codigo: '20',
    nombre: 'Piura',
    provincias: [
      {
        codigo: '2001',
        nombre: 'Piura',
        distritos: [
          { codigo: '200101', nombre: 'Piura' },
          { codigo: '200104', nombre: 'Castilla' },
          { codigo: '200105', nombre: 'Catacaos' },
          { codigo: '200107', nombre: 'Cura Mori' },
          { codigo: '200108', nombre: 'El Tallan' },
          { codigo: '200109', nombre: 'La Arena' },
          { codigo: '200110', nombre: 'La Unión' },
          { codigo: '200111', nombre: 'Las Lomas' },
          { codigo: '200114', nombre: 'Tambo Grande' },
          { codigo: '200115', nombre: 'Veintiseis de Octubre' },
        ],
      },
    ],
  },
  {
    codigo: '21',
    nombre: 'Puno',
    provincias: [
      {
        codigo: '2101',
        nombre: 'Puno',
        distritos: [
          { codigo: '210101', nombre: 'Puno' },
          { codigo: '210102', nombre: 'Acora' },
          { codigo: '210103', nombre: 'Amantani' },
          { codigo: '210104', nombre: 'Atuncolla' },
          { codigo: '210105', nombre: 'Capachica' },
          { codigo: '210106', nombre: 'Chucuito' },
          { codigo: '210107', nombre: 'Coata' },
          { codigo: '210108', nombre: 'Huata' },
          { codigo: '210109', nombre: 'Mañazo' },
          { codigo: '210110', nombre: 'Paucarcolla' },
          { codigo: '210111', nombre: 'Pichacani' },
          { codigo: '210112', nombre: 'Plateria' },
          { codigo: '210113', nombre: 'San Antonio' },
          { codigo: '210114', nombre: 'Tiquillaca' },
          { codigo: '210115', nombre: 'Vilque' },
        ],
      },
    ],
  },
  {
    codigo: '22',
    nombre: 'San Martín',
    provincias: [
      {
        codigo: '2201',
        nombre: 'Moyobamba',
        distritos: [
          { codigo: '220101', nombre: 'Moyobamba' },
          { codigo: '220102', nombre: 'Calzada' },
          { codigo: '220103', nombre: 'Habana' },
          { codigo: '220104', nombre: 'Jepelacio' },
          { codigo: '220105', nombre: 'Soritor' },
          { codigo: '220106', nombre: 'Yantalo' },
        ],
      },
    ],
  },
  {
    codigo: '23',
    nombre: 'Tacna',
    provincias: [
      {
        codigo: '2301',
        nombre: 'Tacna',
        distritos: [
          { codigo: '230101', nombre: 'Tacna' },
          { codigo: '230102', nombre: 'Alto de la Alianza' },
          { codigo: '230103', nombre: 'Calana' },
          { codigo: '230104', nombre: 'Ciudad Nueva' },
          { codigo: '230105', nombre: 'Inclan' },
          { codigo: '230106', nombre: 'Pachia' },
          { codigo: '230107', nombre: 'Palca' },
          { codigo: '230108', nombre: 'Pocollay' },
          { codigo: '230109', nombre: 'Sama' },
          { codigo: '230110', nombre: 'Coronel Gregorio Albarracín Lanchipa' },
          { codigo: '230111', nombre: 'La Yarada los Palos' },
        ],
      },
    ],
  },
  {
    codigo: '24',
    nombre: 'Tumbes',
    provincias: [
      {
        codigo: '2401',
        nombre: 'Tumbes',
        distritos: [
          { codigo: '240101', nombre: 'Tumbes' },
          { codigo: '240102', nombre: 'Corrales' },
          { codigo: '240103', nombre: 'La Cruz' },
          { codigo: '240104', nombre: 'Pampas de Hospital' },
          { codigo: '240105', nombre: 'San Jacinto' },
          { codigo: '240106', nombre: 'San Juan de la Virgen' },
        ],
      },
    ],
  },
  {
    codigo: '25',
    nombre: 'Ucayali',
    provincias: [
      {
        codigo: '2501',
        nombre: 'Coronel Portillo',
        distritos: [
          { codigo: '250101', nombre: 'Calleria' },
          { codigo: '250102', nombre: 'Campoverde' },
          { codigo: '250103', nombre: 'Iparia' },
          { codigo: '250104', nombre: 'Masisea' },
          { codigo: '250105', nombre: 'Yarinacocha' },
          { codigo: '250106', nombre: 'Nueva Requena' },
          { codigo: '250107', nombre: 'Manantay' },
        ],
      },
    ],
  },
];

/**
 * Obtener lista de departamentos
 */
export const getDepartamentos = (): { value: string; label: string }[] => {
  return UBIGEO_PERU.map((dep) => ({
    value: dep.nombre,
    label: dep.nombre,
  }));
};

/**
 * Obtener provincias de un departamento
 */
export const getProvincias = (departamento: string): { value: string; label: string }[] => {
  const dep = UBIGEO_PERU.find((d) => d.nombre === departamento);
  if (!dep) return [];
  return dep.provincias.map((prov) => ({
    value: prov.nombre,
    label: prov.nombre,
  }));
};

/**
 * Obtener distritos de una provincia
 */
export const getDistritos = (
  departamento: string,
  provincia: string
): { value: string; label: string }[] => {
  const dep = UBIGEO_PERU.find((d) => d.nombre === departamento);
  if (!dep) return [];
  const prov = dep.provincias.find((p) => p.nombre === provincia);
  if (!prov) return [];
  return prov.distritos.map((dist) => ({
    value: dist.nombre,
    label: dist.nombre,
  }));
};
