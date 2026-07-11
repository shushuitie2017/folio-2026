/** HUD overlay: trilingual strings (ja default) + language switcher. */

type Lang = 'ja' | 'en' | 'zh'

const STRINGS: Record<Lang, Record<string, string>> = {
  ja: {
    subtitle: 'BlueCat Workshop — 運転して巡るポートフォリオ',
    hint: '<b>WASD / 矢印キー</b>で運転 · <b>Shift</b>ブースト · <b>Space</b>ブレーキ · <b>R</b>リセット · 看板をクリックで開く',
    hintTouch: 'ジョイスティックで方向 · <b>▲</b>前進 <b>▼</b>後退 · 看板をタップで開く'
  },
  en: {
    subtitle: 'BlueCat Workshop — a drivable portfolio',
    hint: 'Drive with <b>WASD / arrows</b> · <b>Shift</b> boost · <b>Space</b> brake · <b>R</b> reset · click boards to open',
    hintTouch: 'Steer with the joystick · <b>▲</b> forward <b>▼</b> reverse · tap boards to open'
  },
  zh: {
    subtitle: 'BlueCat Workshop — 开着车逛的作品集',
    hint: '<b>WASD / 方向键</b>驾驶 · <b>Shift</b>加速 · <b>空格</b>刹车 · <b>R</b>复位 · 点击展板打开项目',
    hintTouch: '摇杆控制方向 · <b>▲</b>前进 <b>▼</b>倒车 · 点展板打开项目'
  }
}

export function setupUi(isTouch: boolean): void {
  const saved = localStorage.getItem('folio-lang') as Lang | null
  let lang: Lang = saved ?? 'ja'

  const apply = () => {
    document.documentElement.lang = lang
    for (const element of Array.from(document.querySelectorAll<HTMLElement>('[data-i18n]'))) {
      let key = element.dataset.i18n!
      if (key === 'hint' && isTouch) key = 'hintTouch'
      element.innerHTML = STRINGS[lang][key] ?? ''
    }
    for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-lang]'))) {
      button.classList.toggle('on', button.dataset.lang === lang)
    }
  }

  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-lang]'))) {
    button.addEventListener('click', () => {
      lang = button.dataset.lang as Lang
      localStorage.setItem('folio-lang', lang)
      apply()
    })
  }
  apply()

  // fade in, and let the hint retire itself after a while
  requestAnimationFrame(() => {
    document.getElementById('fade')?.classList.add('off')
  })
  window.setTimeout(() => {
    document.getElementById('hint')?.classList.add('gone')
  }, 14000)
}
