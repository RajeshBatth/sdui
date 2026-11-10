import type { ThemePatch } from './merge';

export const HOTELS_THEME: ThemePatch = {
  color: {
    htSuggestionFill: '#F4F7FF',
    htSuggestionText: '#11287A',
    htButtonFill: '#FAFAFA',
    htRatingBlue: '#0C58B4',
    htLightBlue: '#EAF5FF',
    htMidBlue: '#CCE8FF',
    htDot: '#D9D9D9',
    htTagFill: '#00000066',
    htOffer: '#E9E519',
    htWhite70: '#FFFFFFB3',
  },
  gradient: {
    htGalleryScrim: { angle: 180, stops: [['#00000000', 0], ['#000000E6', 0.9]] },
    htLuxFade: { angle: 180, stops: [['#FFFFFF', 0], ['#FFFFFF00', 0.6]] },
    htActivityScrim: { angle: 180, stops: [['#00000000', 0.328], ['#00000058', 0.478], ['#000000C7', 0.666], ['#000000', 0.82]] },
    htMyraSummary: { angle: 140, stops: [['#FFFFFF', 0.229], ['#EFF8FF', 0.948]] },
  },
  text: {
    htHotelName: { face: 'black', size: 16, lineHeight: 21 },
    htHotelSub: { face: 'regular', size: 12, lineHeight: 16 },
    htSection: { face: 'semibold', size: 16, lineHeight: 20 },
    htExploreTitle: { face: 'semibold', size: 16, lineHeight: 24 },
    htWhyTitle: { face: 'bold', size: 14, lineHeight: 20 },
    htWhyBody: { face: 'regular', size: 14, lineHeight: 20 },
    htSuggestion: { face: 'regular', size: 12, lineHeight: 16 },
    htCaption: { face: 'regular', size: 12, lineHeight: 16 },
    htSummaryTitle: { face: 'medium', size: 14, lineHeight: 20 },
    htBadge: { face: 'black', size: 11, lineHeight: 14 },
    htRoomTitle: { face: 'bold', size: 14, lineHeight: 20 },
    htRoomPrice: { face: 'bold', size: 16, lineHeight: 21 },
    htCardTitle: { face: 'bold', size: 14, lineHeight: 18 },
    htCardBody: { face: 'regular', size: 12, lineHeight: 15.6 },
    htEmoji: { face: 'regular', size: 16, lineHeight: 28 },
    htActivityTitle: { face: 'semibold', family: 'geist', size: 16, lineHeight: 20 },
    htActivityBody: { face: 'regular', family: 'geist', size: 11, lineHeight: 14 },
    htTag: { face: 'regular', family: 'geist', size: 10, lineHeight: 13 },
    htDetailTitle: { face: 'black', size: 22, lineHeight: 26 },
    htDetailHeading: { face: 'black', size: 18, lineHeight: 22 },
    htDetailBody: { face: 'regular', size: 14, lineHeight: 18 },
    htDetailBold: { face: 'bold', size: 14, lineHeight: 18 },
    htDetailStrong: { face: 'black', size: 14, lineHeight: 19 },
    htDetailReviewTitle: { face: 'black', size: 16, lineHeight: 20 },
    htDetailSmall: { face: 'regular', size: 12, lineHeight: 15 },
    htRatingScore: { face: 'black', size: 16, lineHeight: 19 },
  },
  size: {
    htFeedback: 32,
    htWhyCard: 180,
    htWhyImage: 128,
    htAmenity: 75,
    htAmenityIcon: 32,
    htReviewCard: 272,
    htGuestPhoto: 56,
    htPeek: 340,
  },
  radius: { htGallery: 32, htBadge: 7, htTag: 6 },
  space: { htDotGap: 6 },
  stroke: {
    htSuggestionLine: { width: 1, color: '#E4EBFF' },
    htWhyCard: { width: 1, color: '#CBDFE5' },
    htMyraSummary: { width: 2, color: '#2242B2' },
    htTagBlue: { width: 1, color: '#008CFF' },
    htRatingOutline: { width: 1, color: '#0C58B4' },
    htFade: { width: 1, color: '#3333331A' },
  },
  shadow: {
    htButton: { x: 0, y: 1, blur: 2, color: '#08080814' },
  },
  icon: {
    "ht-arrow": {
      "viewBox": "0 0 24 24",
      "paths": [
        {
          "d": "M13.39 12.14C13.47 12.06 13.47 11.94 13.39 11.86L9.29 7.76C8.9 7.37 8.9 6.73 9.29 6.34C9.68 5.95 10.32 5.95 10.71 6.34L15.66 11.29C16.05 11.68 16.05 12.32 15.66 12.71L10.71 17.66C10.32 18.05 9.68 18.05 9.29 17.66C8.9 17.27 8.9 16.63 9.29 16.24L13.39 12.14Z"
        }
      ]
    },
    "ht-cohort": {
      "viewBox": "0 0 20 20",
      "paths": [
        {
          "d": "M18 10.08C17.53 9.32 17.3 8.43 17.33 7.54V6.5C17.33 5.79 17.12 5.11 16.73 4.52C16.34 3.93 15.78 3.47 15.13 3.2C14.48 2.93 13.77 2.85 13.07 2.99C12.38 3.12 11.74 3.45 11.24 3.95 M12.08 6.68C12.72 6.4 13.29 5.98 13.75 5.45C14.2 5.96 14.75 6.38 15.36 6.66C15.98 6.94 16.65 7.09 17.33 7.09 M16.91 7.07C16.88 7.61 16.72 8.13 16.43 8.59C16.15 9.05 15.75 9.43 15.28 9.69C14.8 9.95 14.27 10.08 13.73 10.08C13.19 10.08 12.66 9.94 12.19 9.67 M0.42 17.08C0.42 15.54 1.03 14.05 2.12 12.96C3.22 11.86 4.7 11.25 6.25 11.25C7.8 11.25 9.28 11.86 10.37 12.96C11.47 14.05 12.08 15.54 12.08 17.08H0.42Z M3.2 4.66C4.03 5.52 5.1 6.11 6.27 6.34C7.45 6.58 8.66 6.45 9.76 5.98 M2.71 6.46C2.71 7.4 3.08 8.3 3.75 8.96C4.41 9.63 5.31 10 6.25 10C7.19 10 8.09 9.63 8.75 8.96C9.42 8.3 9.79 7.4 9.79 6.46C9.79 5.52 9.42 4.62 8.75 3.95C8.09 3.29 7.19 2.92 6.25 2.92C5.31 2.92 4.41 3.29 3.75 3.95C3.08 4.62 2.71 5.52 2.71 6.46Z M12.08 11.49C12.95 11.23 13.87 11.18 14.77 11.34C15.66 11.5 16.51 11.86 17.24 12.41C17.96 12.95 18.56 13.66 18.96 14.47C19.37 15.28 19.58 16.18 19.58 17.08H14.17",
          "stroke": "tone"
        }
      ]
    },
    "ht-lounge": {
      "viewBox": "0 0 32 32",
      "paths": [
        {
          "d": "M15.56 18.98H7.45C7.13 18.98 6.87 18.72 6.87 18.41V13.32C6.87 13.01 7.13 12.75 7.45 12.75H15.56C15.88 12.75 16.13 13.01 16.13 13.32V18.41C16.13 18.72 15.88 18.98 15.56 18.98Z M4 23.49V18.77C4 17.26 5.22 16.04 6.73 16.04C8.24 16.04 9.47 17.26 9.47 18.77V23.49H4Z M13.11 23.49V18.77C13.11 17.26 14.33 16.04 15.84 16.04C17.35 16.04 18.58 17.26 18.58 18.77V23.49H13.11Z M21.69 8H25.97L27.58 12.29H20.08L21.69 8Z M21.12 21.42H26.59V23.56H21.12V21.42Z M23.79 12.78L23.79 21.41",
          "stroke": "tone"
        },
        {
          "d": "M9.69 23.01H13.67V24H9.69Z M9.69 23.01H13.67V24H9.69Z"
        }
      ]
    },
    "ht-pool": {
      "viewBox": "0 0 32 32",
      "paths": [
        {
          "d": "M7 23.56C7 23.56 8.43 24.45 9.55 23.56C10.66 22.67 11.55 23.78 12.07 23.76C12.58 23.73 13.32 22.7 14.15 23.21C14.98 23.73 16.21 24.07 16.93 23.51C17.99 22.7 18.65 23.2 19.45 23.64C20.5 24.24 20.99 22.64 22.34 23.33C23.68 24.02 24.31 23.95 25 23.51 M7 20.56C7 20.56 8.43 21.45 9.55 20.56C10.66 19.67 11.55 20.78 12.07 20.76C12.58 20.73 13.32 19.7 14.15 20.21C14.98 20.73 16.21 21.07 16.93 20.51C17.99 19.7 18.65 20.2 19.45 20.64C20.5 21.24 20.99 19.64 22.34 20.33C23.68 21.02 24.31 20.95 25 20.51 M9.26 18.99V12.82C9.26 10.71 10.98 9 13.09 9C14.37 9 15.5 9.63 16.2 10.59C16.27 10.69 16.33 10.79 16.39 10.89 M16 18.99V12.82C16 10.71 17.71 9 19.83 9C21.94 9 23.65 10.71 23.65 12.82V13.66 M9.27 16.88H16V14H9.27V16.88Z",
          "stroke": "tone"
        }
      ]
    },
    "ht-business": {
      "viewBox": "0 0 32 32",
      "paths": [
        {
          "d": "M18.41 8.34C18.96 8.12 19.58 8 20.23 8C20.88 8 21.5 8.12 22.05 8.34 M16.21 7C17.39 6.37 18.76 6 20.23 6C21.7 6 23.08 6.37 24.25 7 M22.05 23V19C22.05 17.9 21.15 17 20.05 17H9.5C8.4 17 7.5 17.9 7.5 19V23",
          "stroke": "tone"
        },
        {
          "d": "M12.3 9.7L12.49 9.27L12.49 9.27L12.3 9.7ZM12.94 10.66L12.43 10.62L12.94 10.66ZM10.51 8.88L10.32 9.31L12.11 10.14L12.3 9.7L12.49 9.27L10.7 8.44L10.51 8.88ZM12.94 10.66L12.43 10.62L12.43 16.84L12.94 16.88L13.45 16.92L13.45 10.7L12.94 10.66ZM12.3 9.7L12.11 10.14C12.3 10.23 12.43 10.42 12.43 10.62L12.94 10.66L13.45 10.7C13.45 10.1 13.07 9.53 12.49 9.27L12.3 9.7Z M17.38 13.23L17.57 13.67L17.57 13.67L17.38 13.23ZM16.74 14.18L16.23 14.22L16.74 14.18ZM19.16 12.4L19.35 12.84L17.57 13.67L17.38 13.23L17.18 12.79L18.97 11.97L19.16 12.4ZM16.74 14.18L17.25 14.14L17.25 16.96L16.74 17L16.23 17.04L16.23 14.22L16.74 14.18ZM17.38 13.23L17.57 13.67C17.37 13.76 17.25 13.95 17.25 14.14L16.74 14.18L16.23 14.22C16.23 13.63 16.61 13.06 17.18 12.79L17.38 13.23Z"
        }
      ]
    },
    "ht-room-service": {
      "viewBox": "0 0 32 32",
      "paths": [
        {
          "d": "M17.85 12.63L21.17 10.47C21.76 10.09 22.42 9.84 23.11 9.74L25.51 9.38C26.54 9.23 27.53 9.86 27.83 10.86L27.84 10.87C28.44 12.87 28.43 15.01 27.82 17.01C27.53 17.97 26.58 18.59 25.57 18.48L23.7 18.27C22.97 18.19 22.27 17.95 21.65 17.55L17.85 15.16V12.63Z M15.79 12.63L12.48 10.47C11.89 10.09 11.22 9.84 10.53 9.74L8.14 9.38C7.1 9.23 6.11 9.86 5.81 10.86L5.81 10.87C5.21 12.87 5.22 15.01 5.82 17.01C6.12 17.97 7.07 18.59 8.07 18.48L9.95 18.27C10.68 18.19 11.38 17.95 12 17.55L15.79 15.16V12.63Z M18.11 16.25H15.35C14.83 16.25 14.41 15.83 14.41 15.31V12.57C14.41 12.05 14.83 11.63 15.35 11.63H18.11C18.63 11.63 19.05 12.05 19.05 12.57V15.31C19.05 15.83 18.63 16.25 18.11 16.25Z M19.05 13.38L22.32 12.52 M19.05 14.27L21 14.67 M14.08 13.38L10.8 12.52 M14.08 14.27L12.12 14.67",
          "stroke": "tone"
        }
      ]
    },
    "ht-spa": {
      "viewBox": "0 0 16 16",
      "paths": [
        {
          "d": "M8.01 9.02C7.45 8.56 6.99 7.99 6.67 7.35C6.34 6.7 6.16 5.99 6.14 5.27C6.15 4.62 6.3 3.98 6.57 3.38C6.83 2.79 7.22 2.25 7.69 1.8C7.78 1.72 7.89 1.67 8.01 1.67C8.13 1.67 8.25 1.72 8.33 1.8C8.81 2.25 9.19 2.79 9.46 3.38C9.72 3.98 9.87 4.62 9.89 5.27C9.86 5.99 9.68 6.7 9.36 7.35C9.03 7.99 8.57 8.56 8.01 9.02Z M9.84 4.61C10.73 4 11.79 3.68 12.88 3.69C13 3.69 13.12 3.74 13.2 3.82C13.29 3.91 13.34 4.03 13.34 4.15C13.36 4.8 13.25 5.45 13.02 6.06C12.79 6.66 12.44 7.22 11.99 7.69C11.46 8.18 10.83 8.56 10.14 8.79C9.46 9.01 8.73 9.09 8.01 9.02 M6.19 4.62C5.29 4 4.22 3.68 3.12 3.69C3 3.69 2.88 3.74 2.79 3.82C2.71 3.91 2.66 4.03 2.66 4.15C2.64 4.8 2.75 5.45 2.98 6.06C3.21 6.67 3.56 7.22 4.01 7.69C4.54 8.19 5.18 8.56 5.87 8.79C6.56 9.02 7.29 9.1 8.01 9.02 M12.69 9.64C12.69 10.94 10.59 11.98 8 11.98C5.41 11.98 3.31 10.94 3.31 9.64 M14.44 7.76C14.82 8.32 15.02 8.97 15.03 9.64C15.03 12.23 11.88 14.33 8 14.33C4.11 14.33 0.97 12.23 0.97 9.64C0.97 8.97 1.18 8.32 1.55 7.77",
          "stroke": "tone"
        }
      ]
    },
    "ht-bookmark": {
      "viewBox": "0 0 16 16",
      "paths": [
        {
          "d": "M13.93 7.41V10.74C13.93 12.81 13.93 13.84 13.44 14.29C13.21 14.5 12.91 14.64 12.6 14.68C11.94 14.75 11.17 14.07 9.63 12.71C8.96 12.11 8.62 11.81 8.22 11.73C8.03 11.69 7.83 11.69 7.64 11.73C7.24 11.81 6.9 12.11 6.22 12.71C4.69 14.07 3.92 14.75 3.26 14.68C2.95 14.64 2.65 14.5 2.42 14.29C1.93 13.84 1.93 12.81 1.93 10.74V7.41C1.93 4.55 1.93 3.12 2.81 2.24C3.69 1.35 5.1 1.35 7.93 1.35C10.76 1.35 12.17 1.35 13.05 2.24C13.93 3.12 13.93 4.55 13.93 7.41Z M9.93 4.01H5.93",
          "stroke": "tone"
        }
      ]
    },
    "ht-family": {
      "viewBox": "0 0 17.9985 18.0059",
      "paths": [
        {
          "d": "M13.4 4.7C14.7 4.7 15.8 3.6 15.8 2.3C15.8 1.1 14.7 0 13.4 0C12.1 0 11.1 1.1 11.1 2.3C11.1 3.6 12.1 4.7 13.4 4.7Z M12.4 13.6L11.4 9.7C11.2 9.1 10.6 8.6 9.9 8.6H8.1C7.4 8.6 6.8 9.1 6.6 9.7L5.6 13.6C5.5 14.2 5.9 14.8 6.5 14.8H7.3V17.2C7.3 17.7 7.6 18 8 18H10C10.4 18 10.7 17.7 10.7 17.2V14.8H11.5C12.1 14.8 12.5 14.2 12.4 13.6Z M9 8.2C10 8.2 10.7 7.4 10.7 6.4C10.7 5.5 10 4.7 9 4.7C8 4.7 7.3 5.5 7.3 6.4C7.3 7.4 8 8.2 9 8.2Z M18 12.1L16.6 6.8C16.4 5.9 15.5 5.2 14.6 5.2H12.3C11.9 5.2 11.6 5.3 11.3 5.5C11.4 5.8 11.4 6.1 11.4 6.4C11.4 7.1 11.2 7.6 10.8 8.1C11.4 8.4 11.9 8.9 12.1 9.6L12.8 12.6L13 13.4C13.1 13.5 13.1 13.6 13.1 13.6C13.1 14 13 14.5 12.7 14.8C12.4 15.2 12 15.5 11.5 15.5H11.4V17.2C11.4 17.4 11.4 17.5 11.4 17.7C11.6 17.9 11.8 18 12.1 18H14.7C15.3 18 15.8 17.5 15.8 16.9V13.6H16.8C17.6 13.6 18.2 12.9 18 12.1Z M5 13.4L5.2 12.6L5.9 9.6C6.1 8.9 6.6 8.4 7.2 8.1C6.8 7.6 6.6 7.1 6.6 6.4C6.6 6.1 6.6 5.8 6.7 5.5C6.4 5.3 6.1 5.2 5.7 5.2H3.4C2.5 5.2 1.6 5.9 1.4 6.8L0 12.1C-0.2 12.9 0.4 13.6 1.2 13.6H2.2V17C2.2 17.5 2.7 18 3.3 18H5.9C6.2 18 6.4 17.9 6.6 17.7C6.6 17.5 6.6 17.4 6.6 17.2V15.5H6.5C6 15.5 5.6 15.2 5.3 14.8C5 14.5 4.9 14 4.9 13.6C4.9 13.6 4.9 13.5 5 13.4Z M6.9 2.4C6.9 1.1 5.9 0 4.6 0C3.3 0 2.2 1 2.2 2.3C2.2 3.6 3.3 4.7 4.6 4.7C5.9 4.7 6.9 3.6 6.9 2.4Z"
        }
      ]
    },
    "ht-pin": {
      "viewBox": "0 0 20 20",
      "paths": [
        {
          "d": "M4.73 3.41C6.13 2.03 8.02 1.25 9.98 1.25C11.95 1.25 13.84 2.01 15.25 3.39H15.25L15.28 3.41C18.23 6.32 18.24 10.99 15.31 13.86L10.59 18.51C10.43 18.66 10.22 18.75 10 18.75C9.78 18.75 9.57 18.66 9.42 18.51L4.69 13.86C4 13.18 3.45 12.37 3.07 11.48C2.69 10.58 2.5 9.62 2.5 8.65C2.5 7.68 2.69 6.72 3.07 5.83C3.45 4.93 4 4.12 4.69 3.45L4.73 3.41ZM10 5.42C9.67 5.42 9.35 5.48 9.04 5.61C8.74 5.73 8.46 5.92 8.23 6.15C8 6.38 7.82 6.66 7.69 6.96C7.56 7.26 7.5 7.59 7.5 7.92C7.5 8.24 7.56 8.57 7.69 8.87C7.82 9.18 8 9.45 8.23 9.68C8.46 9.92 8.74 10.1 9.04 10.23C9.35 10.35 9.67 10.42 10 10.42C10.66 10.42 11.3 10.15 11.77 9.68C12.24 9.21 12.5 8.58 12.5 7.92C12.5 7.25 12.24 6.62 11.77 6.15C11.3 5.68 10.66 5.42 10 5.42Z"
        }
      ]
    },
    "ht-chevron": {
      "viewBox": "0 0 14 14",
      "paths": [
        {
          "d": "M5.25 10.5L8.75 7L5.25 3.5",
          "stroke": "tone",
          "strokeWidth": 2
        }
      ]
    }
  },
  look: {
    card: {
      htSuggestions: { fill: 'htSuggestionFill', radius: 'lg', divider: 'htSuggestionLine' },
      htIconButton: { fill: 'htButtonFill', stroke: 'avatar', radius: 'sm', shadow: 'htButton' },
      htRoom: { fill: 'htButtonFill', stroke: 'panel', radius: 'lg', padding: 'lg' },
      htSummary: { fill: 'surfaceMuted', radius: 'sm', padding: 'lg' },
      htWhyCard: { fill: 'surface', stroke: 'htWhyCard', radius: 'lg' },
      htRatingBadge: { fill: 'htRatingBlue', radius: 'htBadge' },
      htGallery: { radius: 'htGallery' },
      htActivity: { radius: 'lg', padding: 'md' },
      htDetail: { fill: 'surface', radius: 'lg', padding: 'md' },
      htScore: { fill: 'htRatingBlue', radius: 'sm' },
      htLocationTile: { fill: 'htMidBlue', radius: 'sm' },
      htCohort: { fill: 'htLightBlue', radius: 'xs' },
      htMyraSummary: { gradient: 'htMyraSummary', stroke: 'htMyraSummary', radius: 'lg', padding: 'md' },
      htReview: { fill: 'surface', stroke: 'divider', radius: 'lg', padding: 'md' },
      htAllPhotos: { fill: 'htLightBlue', radius: 'sm' },
    },
    pill: {
      htEmoji: { fill: 'surface', radius: 'htTag', paddingX: 'xs', text: 'htEmoji', tone: 'primary' },
      htTag: { fill: 'htTagFill', radius: 'htTag', paddingX: 'sm', paddingY: 'xs', text: 'htTag', tone: 'onAccent' },
      htBeachfront: { fill: 'surface', stroke: 'htTagBlue', radius: 'xs', paddingX: 'xs', paddingY: 'xxs', text: 'htDetailBold', tone: 'primary' },
      htRatingOutline: { fill: 'surface', stroke: 'htRatingOutline', radius: 'sm', paddingX: 'sm', paddingY: 'sm', text: 'htDetailStrong', tone: 'htRatingBlue' },
    },
    button: {
      htSuggestion: { text: 'htSuggestion', tone: 'htSuggestionText', paddingTop: 'md', paddingBottom: 'md', gap: 'sm', iconSize: 'iconMd' },
      htLink: { text: 'label', tone: 'link', gap: 'xxs', iconSize: 'iconXs' },
    },
    image: {
      htThumb: { width: 'thumb', height: 'thumb', radius: 'image' },
      htWhy: { height: 'htWhyImage', radius: 'none' },
      htGuest: { width: 'htGuestPhoto', height: 'htGuestPhoto', radius: 'sm' },
    },
    indicator: {
      htDots: { dot: 'dot', activeWidth: 'dot', activeHeight: 'dot', gap: 'htDotGap', radius: 'pill', active: 'accent', inactive: 'htDot' },
    },
  },
};
