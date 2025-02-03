import type { Team } from '@heroku-cli/schema';

/**
 * Maps team by their respective enterprise account names
 *
 * @param teams
 * @returns
 */
export function mapTeamsByEnterpriseAccount(teams: Team[] = []): Map<string, Team[]> {
  const teamsByEnterpriseAccountName = new Map<string, Team[]>();
  for (const team of teams) {
    const enterpriseName = team?.enterprise_account?.name ?? 'Not Attached to Enterprise Account';
    const teams = teamsByEnterpriseAccountName.get(enterpriseName) ?? [];
    teams.push(team);
    teamsByEnterpriseAccountName.set(enterpriseName, teams);
  }
  return teamsByEnterpriseAccountName;
}
