import type { ThemePatch } from './merge';

export const FLIGHTS_THEME: ThemePatch = {
  color: {
    flIndigo: '#21418F',
    flRouteTitle: '#202124',
    flFastestFill: '#F8EFFF',
    flFastestTone: '#3023AE',
    flCheapGreen: '#298217',
    flCheapGreenFill: '#DAF7D4',
    flDepartFill: '#E5F4FF',
    flLogoTile: '#F0F0F0',
    flChooseFill: '#F5FBFF',
    flChooseTone: '#3167D3',
  },
  gradient: {
    flRow: { angle: 259, stops: [['#F4F5F6', 0], ['#FCFCFD', 0.978]] },
    flNumber: { angle: 180, stops: [['#E5F4FF', 0], ['#FAFDFF', 1]] },
    flBarH: { angle: 270, stops: [['#011607', 0], ['#3167D3', 0.572], ['#59BAFF', 1]] },
    flRibbonMuted: { angle: 132, stops: [['#F4F5F6', 0.095], ['#FCFCFD', 0.475]] },
  },
  text: {
    flTitle: { face: 'bold', size: 16, lineHeight: 21 },
    flPrice: { face: 'bold', size: 14, lineHeight: 18 },
    flNumber: { face: 'bold', size: 24, lineHeight: 31 },
    flChoose: { face: 'medium', size: 16, lineHeight: 21 },
    flLogoCount: { face: 'semibold', size: 12, lineHeight: 16 },
  },
  size: {
    flThumbW: 56,
    flThumbH: 52,
    flLogo: 20,
    flLogoLg: 36,
    flLogoImg: 22,
    flRowH: 60,
    flChooseH: 26,
    flColAirline: 110,
    flGridCol: 56,
  },
  stroke: {
    flRow: { width: 1, color: '#E5E5E566' },
    flFastest: { width: 1, color: '#3023AE' },
    flCheap: { width: 1, color: '#298217' },
    flLogo: { width: 0.625, color: '#E5E5E5' },
    flChoose: { width: 1, color: '#3167D3' },
  },
  look: {
    card: {
      flRow: { gradient: 'flRow', stroke: 'flRow', radius: 'md' },
      flRibbonMuted: { gradient: 'flRibbonMuted', stroke: 'flRow', radius: 'md' },
      flNumberTile: { gradient: 'flNumber', radius: 'sm' },
      flLogoTile: { fill: 'flLogoTile', radius: 'xs' },
      flIndigoTile: { fill: 'flIndigo', radius: 'sm' },
      flLogoCircle: { fill: 'surface', stroke: 'flLogo', radius: 'pill' },
    },
    pill: {
      flFastest: { fill: 'flFastestFill', stroke: 'flFastest', radius: 'xs', paddingX: 'xxs', paddingY: 'xxs', text: 'badge', tone: 'flFastestTone' },
      flCheapest: { fill: 'flCheapGreenFill', stroke: 'flCheap', radius: 'xs', paddingX: 'xxs', paddingY: 'xxs', text: 'badge', tone: 'flCheapGreen' },
      flDepart: { fill: 'flDepartFill', radius: 'sm', paddingX: 'sm', paddingY: 'xs', gap: 'xxs', text: 'microBold', tone: 'accent', iconSize: 'iconXs' },
      flLogoCount: { fill: 'surface', stroke: 'flLogo', radius: 'pill', width: 'flLogo', height: 'flLogo', text: 'flLogoCount', tone: 'primary', align: 'center' },
    },
    button: {
      flChoose: { fill: 'flChooseFill', stroke: 'flChoose', radius: 'pill', paddingX: 'sm', paddingTop: 'xxs', paddingBottom: 'xxs', text: 'flChoose', tone: 'flChooseTone', width: 'hug' },
      flSeeFlights: { fill: 'accent', radius: 'sm', paddingX: 'md', paddingTop: 'sm', paddingBottom: 'sm', gap: 'xs', iconSize: 'iconSm', text: 'label', tone: 'onAccent' },
    },
    image: {
      flThumb: { width: 'flThumbW', height: 'flThumbH', radius: 'sm' },
      flLogo: { width: 'flLogo', height: 'flLogo', radius: 'pill', stroke: 'flLogo' },
      flLogoSq: { width: 'flLogo', height: 'flLogo', radius: 'xs' },
      flLogoLg: { width: 'flLogoImg', height: 'flLogoImg', fit: 'contain' },
    },
    table: {
      flGrid: { stroke: 'box', radius: 'md', rowLine: 'box', headerText: 'micro', headerTone: 'secondary', headerPaddingX: 'xs', headerPaddingY: 'sm', cellPadding: 'xs' },
      flCompare: { stroke: 'box', radius: 'md', rowLine: 'box', headerFill: 'inputFill', headerText: 'captionBold', headerTone: 'primary', headerPaddingX: 'sm', headerPaddingY: 'md', cellPadding: 'sm' },
    },
  },
};
