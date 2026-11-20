// Colores oficiales aproximados. p = principal, s = secundario, t = acento legible sobre fondo oscuro
export type Equipo = { ciudad: string; nombre: string; p: string; s: string; t: string }

export const EQUIPOS: Record<string, Equipo> = {
  ARI: { ciudad: 'Arizona', nombre: 'Cardinals', p: '#97233F', s: '#FFB612', t: '#FF5C7A' },
  ATL: { ciudad: 'Atlanta', nombre: 'Falcons', p: '#A71930', s: '#000000', t: '#FF4D5E' },
  BAL: { ciudad: 'Baltimore', nombre: 'Ravens', p: '#241773', s: '#9E7C0C', t: '#C9A227' },
  BUF: { ciudad: 'Buffalo', nombre: 'Bills', p: '#00338D', s: '#C60C30', t: '#3D8BFF' },
  CAR: { ciudad: 'Carolina', nombre: 'Panthers', p: '#0085CA', s: '#101820', t: '#3BB7FF' },
  CHI: { ciudad: 'Chicago', nombre: 'Bears', p: '#0B162A', s: '#C83803', t: '#FF6A2B' },
  CIN: { ciudad: 'Cincinnati', nombre: 'Bengals', p: '#FB4F14', s: '#000000', t: '#FF7A45' },
  CLE: { ciudad: 'Cleveland', nombre: 'Browns', p: '#311D00', s: '#FF3C00', t: '#FF6A33' },
  DAL: { ciudad: 'Dallas', nombre: 'Cowboys', p: '#003594', s: '#869397', t: '#5E8DFF' },
  DEN: { ciudad: 'Denver', nombre: 'Broncos', p: '#FB4F14', s: '#002244', t: '#FF7A45' },
  DET: { ciudad: 'Detroit', nombre: 'Lions', p: '#0076B6', s: '#B0B7BC', t: '#38B2FF' },
  GB: { ciudad: 'Green Bay', nombre: 'Packers', p: '#203731', s: '#FFB612', t: '#FFC23D' },
  HOU: { ciudad: 'Houston', nombre: 'Texans', p: '#03202F', s: '#A71930', t: '#FF4D5E' },
  IND: { ciudad: 'Indianapolis', nombre: 'Colts', p: '#002C5F', s: '#A2AAAD', t: '#4D9BFF' },
  JAX: { ciudad: 'Jacksonville', nombre: 'Jaguars', p: '#006778', s: '#D7A22A', t: '#2FD3E8' },
  KC: { ciudad: 'Kansas City', nombre: 'Chiefs', p: '#E31837', s: '#FFB81C', t: '#FF4D66' },
  LA: { ciudad: 'Los Angeles', nombre: 'Rams', p: '#003594', s: '#FFA300', t: '#FFB833' },
  LAC: { ciudad: 'Los Angeles', nombre: 'Chargers', p: '#0080C6', s: '#FFC20E', t: '#33B5FF' },
  LV: { ciudad: 'Las Vegas', nombre: 'Raiders', p: '#1A1A1A', s: '#A5ACAF', t: '#C8CED1' },
  MIA: { ciudad: 'Miami', nombre: 'Dolphins', p: '#008E97', s: '#FC4C02', t: '#22D3DD' },
  MIN: { ciudad: 'Minnesota', nombre: 'Vikings', p: '#4F2683', s: '#FFC62F', t: '#A77BFF' },
  NE: { ciudad: 'New England', nombre: 'Patriots', p: '#002244', s: '#C60C30', t: '#FF4D66' },
  NO: { ciudad: 'New Orleans', nombre: 'Saints', p: '#9F8958', s: '#101820', t: '#D3BC8D' },
  NYG: { ciudad: 'New York', nombre: 'Giants', p: '#0B2265', s: '#A71930', t: '#4D7BFF' },
  NYJ: { ciudad: 'New York', nombre: 'Jets', p: '#125740', s: '#FFFFFF', t: '#2FD08A' },
  PHI: { ciudad: 'Philadelphia', nombre: 'Eagles', p: '#004C54', s: '#A5ACAF', t: '#1FC2C9' },
  PIT: { ciudad: 'Pittsburgh', nombre: 'Steelers', p: '#101820', s: '#FFB612', t: '#FFC23D' },
  SEA: { ciudad: 'Seattle', nombre: 'Seahawks', p: '#002244', s: '#69BE28', t: '#7DDB3A' },
  SF: { ciudad: 'San Francisco', nombre: '49ers', p: '#AA0000', s: '#B3995D', t: '#FF4040' },
  TB: { ciudad: 'Tampa Bay', nombre: 'Buccaneers', p: '#D50A0A', s: '#FF7900', t: '#FF4D4D' },
  TEN: { ciudad: 'Tennessee', nombre: 'Titans', p: '#0C2340', s: '#4B92DB', t: '#6FB0FF' },
  WAS: { ciudad: 'Washington', nombre: 'Football Team', p: '#5A1414', s: '#FFB612', t: '#FFC23D' },
}

export const eq = (abbr: string): Equipo => EQUIPOS[abbr] ?? { ciudad: abbr, nombre: '', p: '#333', s: '#999', t: '#ccc' }
