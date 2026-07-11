export interface ProjectEntry {
  name: string
  tag: string
  url: string
  accent: string
}

/** Data-driven content: swap this list and the world rebuilds itself. */
export const PROJECTS: ProjectEntry[] = [
  { name: 'HardwareLab', tag: '3D hardware teardowns', url: 'https://hardware.bluecatbot.com', accent: '#3f74e8' },
  { name: 'GameBox', tag: '74 game modules', url: 'https://gamebox.bluecatbot.com', accent: '#f05a48' },
  { name: 'SVGSafe', tag: '6000+ free SVGs', url: 'https://svg.bluecatbot.com', accent: '#3cb8a6' },
  { name: 'TIANYA', tag: 'forum time capsule', url: 'https://tianya.bluecatbot.com', accent: '#a5713d' },
  { name: 'VLOG', tag: 'trilingual daily blog', url: 'https://vlog.bluecatbot.com', accent: '#8f7fd4' },
  { name: 'XUANJI', tag: 'divination studio', url: 'https://xuanji.bluecatbot.com', accent: '#2b3a66' },
  { name: 'SAKATA', tag: 'trading visual novel', url: 'https://sakata.bluecatbot.com', accent: '#e8963d' },
  { name: 'MODKEYS', tag: '3D keyboard builder', url: 'https://keyboard.bluecatbot.com', accent: '#7dbf6a' },
  { name: 'GUJIAN', tag: 'ancient architecture', url: 'https://gujian.bluecatbot.com', accent: '#c9503c' },
  { name: 'ThreeSkills', tag: 'Three.js game skills', url: 'https://threejsskills.bluecatbot.com', accent: '#4a90d9' },
  { name: 'XIUXIAN', tag: 'cultivation MMO', url: 'https://game.bluecatbot.com', accent: '#6c5ce7' },
  { name: 'LEARN', tag: 'kids learn Claude', url: 'https://learn.bluecatbot.com', accent: '#ffb03a' }
]

export const LINKS = [
  { name: 'GitHub', tag: 'shushuitie2017', url: 'https://github.com/shushuitie2017', accent: '#33343a' },
  { name: 'BLUECAT', tag: 'all projects portal', url: 'https://bluecatbot.com', accent: '#3f74e8' }
]
