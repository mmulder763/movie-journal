/**
 * TMDB geeft per dienst geen directe link naar de titel; daarom openen we de zoekpagina van
 * de dienst met de titel erin. Onbekende diensten: zoeken via Google op "titel dienst".
 */
const SEARCH: [RegExp, (q: string) => string][] = [
  [/netflix/i, (q) => `https://www.netflix.com/search?q=${q}`],
  [/disney/i, (q) => `https://www.disneyplus.com/nl-nl/search?q=${q}`],
  [/amazon|prime video/i, (q) => `https://www.primevideo.com/search/ref=atv_nb_sug?phrase=${q}`],
  [/hbo|max/i, (q) => `https://play.hbomax.com/search?q=${q}`],
  [/apple/i, (q) => `https://tv.apple.com/nl/search?term=${q}`],
  [/videoland/i, (q) => `https://v2.videoland.com/search?q=${q}`],
  [/skyshowtime/i, (q) => `https://www.skyshowtime.com/nl/search?q=${q}`],
  [/path[eé]/i, (q) => `https://www.pathe-thuis.nl/zoeken?q=${q}`],
  [/google play/i, (q) => `https://play.google.com/store/search?q=${q}&c=movies`],
  [/rakuten/i, (q) => `https://www.rakuten.tv/nl/search?q=${q}`],
  [/npo/i, (q) => `https://npo.nl/start/zoeken?zoekTerm=${q}`],
  [/viaplay/i, (q) => `https://viaplay.nl/search?query=${q}`],
  [/youtube/i, (q) => `https://www.youtube.com/results?search_query=${q}`],
  [/mubi/i, (q) => `https://mubi.com/nl/search/films?query=${q}`],
  [/paramount/i, (q) => `https://www.paramountplus.com/nl/search/?q=${q}`],
]

export function providerLink(provider: string, title: string): string {
  const q = encodeURIComponent(title)
  const hit = SEARCH.find(([re]) => re.test(provider))
  return hit ? hit[1](q) : `https://www.google.com/search?q=${encodeURIComponent(`${title} ${provider}`)}`
}
