import type { Space } from '@heroku-cli/schema';

/**
 * Maps spaces by their respective organization names
 *
 * @param spaces
 * @returns
 */
export function mapSpacesByOrganization(spaces: Space[] = []): Map<string, Space[]> {
  spaces.sort((a, b) => {
    if (a.shield && b.shield) {
      return a.name.localeCompare(b.name);
    }
    if (a.shield) {
      return -1;
    }
    if (b.shield) {
      return 1;
    }
    return 0;
  });

  const spacesByOrganizationName = new Map<string, Space[]>();
  for (const space of spaces) {
    const organizationName = space.organization.name as string;
    const spaces = spacesByOrganizationName.get(organizationName) ?? [];
    spaces.push(space);
    spacesByOrganizationName.set(organizationName, spaces);
  }
  return spacesByOrganizationName;
}
