import assert from 'assert';
import sinon from 'sinon';
import vscode from 'vscode';
import type { GitExtension, Remote, Repository } from '../../../@types/git';
import { getHerokuAppNames } from './git-utils';

suite('Git Utils', () => {
  let gitRemotes: Remote[];

  setup(() => {
    gitRemotes = [
      {
        name: 'heroku',
        pushUrl: 'https://git.heroku.com/app1.git',
        isReadOnly: false
      },
      {
        name: 'heroku-staging',
        pushUrl: 'https://git.heroku.com/app2-staging.git',
        isReadOnly: false
      },
      {
        name: 'origin',
        pushUrl: 'https://github.com/user/repo.git',
        isReadOnly: false
      }
    ];
    const mockWorkspaceFolder: vscode.WorkspaceFolder = {
      uri: vscode.Uri.file('/test/path')
    } as vscode.WorkspaceFolder;
    sinon.replace(vscode.extensions, 'getExtension', (): any => {
      return {
        isActive: true,
        exports: {
          getAPI: () => ({
            repositories: [
              {
                rootUri: vscode.Uri.file('/test/path'),
                state: { remotes: gitRemotes }
              } as unknown as Repository
            ]
          })
        } as unknown as GitExtension
      } as vscode.Extension<GitExtension>;
    });
    sinon.replaceGetter(vscode.workspace, 'workspaceFolders', () => [mockWorkspaceFolder]);
  });

  teardown(() => {
    sinon.restore();
  });

  suite('getHerokuAppNames', () => {
    test('should return an array of Heroku app names', async () => {
      const result = await getHerokuAppNames();
      assert.deepStrictEqual(result, ['app1', 'app2-staging']);
    });

    test('should return an empty array if no Heroku remotes are found', async () => {
      gitRemotes = [
        {
          name: 'origin',
          pushUrl: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
          isReadOnly: false
        }
      ];

      const result = await getHerokuAppNames();
      assert.deepStrictEqual(result, []);
    });
  });
});
