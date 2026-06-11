import type { DirectoryPerson, NameSearchResult } from "./types.js";

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getNameTokens(value: string): string[] {
  return normalizeName(value).split(" ").filter(Boolean);
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
        ? matrix[i - 1][j - 1]
        : Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
    }
  }

  return matrix[b.length][a.length];
}

export function searchPeopleByNameFuzzy(
  query: string,
  people: DirectoryPerson[],
  maxResults = 5
): NameSearchResult[] {
  const queryNorm = normalizeName(query);
  const queryTokens = getNameTokens(query);

  if (!queryNorm) return [];

  return people
    .map(person => {
      const fullNameNorm = normalizeName(person.fullName);
      const nameTokens = getNameTokens(person.fullName);
      let score = 0;

      if (fullNameNorm === queryNorm) score += 100;
      if (fullNameNorm.startsWith(queryNorm)) score += 60;
      if (fullNameNorm.includes(queryNorm)) score += 40;

      for (const queryToken of queryTokens) {
        for (const nameToken of nameTokens) {
          if (nameToken === queryToken) {
            score += 30;
          } else if (nameToken.startsWith(queryToken)) {
            score += 20;
          } else if (nameToken.includes(queryToken)) {
            score += 10;
          }

          const distance = levenshteinDistance(queryToken, nameToken);
          if (distance === 1) score += 12;
          else if (distance === 2 && queryToken.length >= 5) score += 6;
        }
      }

      return { person, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

export function shouldAutoSelectName(results: NameSearchResult[]): boolean {
  if (results.length === 0) return false;
  const [top, second] = results;
  if (!second && top.score >= 80) return true;
  if (second && top.score >= 90 && top.score - second.score >= 30) return true;
  return false;
}
