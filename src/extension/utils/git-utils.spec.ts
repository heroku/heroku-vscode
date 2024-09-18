import proxyquire from 'proxyquire';
import assert from 'assert';
import sinon from 'sinon';

suite('Git Utils', () => {
  let gitUtils: { findGitConfigFileLocation: CallableFunction; getHerokuAppNames: CallableFunction };
  let execStub: sinon.SinonStub;
  let vscodeStub: {};

  setup(() => {
    execStub = sinon.stub();
    vscodeStub = {
      workspace: {
        workspaceFolders: [{ uri: { path: '/test/path' } }]
      }
    };

    gitUtils = proxyquire('./git-utils', {
      'node:child_process': { exec: execStub },
      vscode: vscodeStub
    });
  });

  teardown(() => {
    sinon.restore();
  });

  suite('findGitConfigFileLocation', () => {
    test('should return the git config file location', async () => {
      execStub.yields(null, { stdout: '.git' });

      const result = await gitUtils.findGitConfigFileLocation();
      assert.strictEqual(result, '/test/path/.git/config');
      assert(execStub.calledOnce);
      assert.strictEqual(execStub.firstCall.args[0], 'git rev-parse --git-dir');
    });

    test('should throw an error if git command fails', async () => {
      execStub.yields(null, { stderr: 'Git error' });

      await assert.rejects(async () => await gitUtils.findGitConfigFileLocation(), { message: 'Git error' });
    });
  });

  suite('getHerokuAppNames', () => {
    test('should return an array of Heroku app names', async () => {
      const gitRemotes = `
        heroku\thttps://git.heroku.com/app1.git (fetch)
        heroku\thttps://git.heroku.com/app1.git (push)
        origin\thttps://github.com/user/repo.git (fetch)
        origin\thttps://github.com/user/repo.git (push)
        heroku-staging\thttps://git.heroku.com/app2-staging.git (fetch)
        heroku-staging\thttps://git.heroku.com/app2-staging.git (push)
      `;
      execStub.yields(null, { stdout: gitRemotes });

      const result = await gitUtils.getHerokuAppNames();
      assert.deepStrictEqual(result, ['app1', 'app2-staging']);
      assert(execStub.calledOnce);
      assert.strictEqual(execStub.firstCall.args[0], 'git remote -v');
    });

    test('should return an empty array if no Heroku remotes are found', async () => {
      const gitRemotes = `
        origin\thttps://github.com/user/repo.git (fetch)
        origin\thttps://github.com/user/repo.git (push)
      `;
      execStub.yields(null, { stdout: gitRemotes });

      const result = await gitUtils.getHerokuAppNames();
      assert.deepStrictEqual(result, []);
    });

    test('should throw an error if git command fails', async () => {
      execStub.yields(null, { stderr: 'Git error' });

      await assert.rejects(async () => await gitUtils.getHerokuAppNames(), { message: 'Git error' });
    });
  });
});
