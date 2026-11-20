# Releases

The first release is `0.1.0a1`, a functional alpha for evaluation. This checkpoint
does not complete Phase 4. Broader accessibility review, external-application
clipboard checks, UX refinement, and hybrid cells remain separate work.

## One-time setup

1. Push the reviewed code to `https://github.com/allcaps/wagtail-table`.
2. In GitHub repository settings, create an environment named `pypi`. Add a
   required reviewer if available for the repository/account, and restrict
   deployments to release tags matching `v*`.
3. In your PyPI account's Publishing settings, add a pending GitHub publisher:

   | Field | Value |
   | --- | --- |
   | PyPI project name | `wagtail-table` |
   | GitHub owner | `allcaps` |
   | Repository | `wagtail-table` |
   | Workflow filename | `publish.yml` |
   | Environment | `pypi` |

   A pending publisher creates the project on the first successful upload. It
   does **not** reserve the name beforehand. If the project already exists under
   your account, add a normal Trusted Publisher with the same GitHub settings.
   No PyPI API token or repository secret is needed. See the official
   [pending publisher instructions](https://docs.pypi.org/trusted-publishers/creating-a-project-through-oidc/).

## Prepare and review

1. Set the version in `pyproject.toml` and update `CHANGELOG.md`. Before tagging,
   replace the release's `Unreleased` heading with its actual release date.
2. Run:

   ```sh
   make install
   make test
   npx playwright install chromium
   make test-browser
   make check-distribution
   git diff --check
   ```

   `make test` verifies committed frontend assets against a rebuild. If authored
   frontend files have changed, run `make build` and review the generated changes.
   `make check-distribution` creates checked wheel/sdist files in `dist/`, verifies
   their contents and metadata, rebuilds a wheel from the sdist, and installs it
   into a fresh environment outside the checkout. Node and npm are unavailable
   throughout these packaging checks. Wagtail and Django are constrained to the
   versions used by the invoking test environment; broader compatibility is not
   inferred from this check.
3. Inspect the artifacts and release notes. Confirm the README describes actual
   features, known limits, and the verified stack. Do not describe synthetic
   clipboard fixtures as proof of compatibility with external applications.
4. Commit and push the reviewed changes. Require green CI for that commit,
   including the browser suite and distribution checks. Record any checks blocked
   locally and use the corresponding successful CI run as evidence.

## Publish after review

Pushing a matching version tag starts publication. Do this only after the
preparation review and account configuration are complete:

```sh
git tag -a v0.1.0a1 -m 'Release 0.1.0a1'
git push origin v0.1.0a1
```

The release workflow verifies the tag/version match, runs the complete test suite
and packaging checks, and uploads the checked distributions as a workflow
artifact. A separate job downloads those same files and runs
`uv publish --trusted-publishing always` in the `pypi` environment. Only that job
has OIDC publishing permission. Approve the environment deployment if a reviewer
is configured. Publication does not depend on a previous workflow run's status;
the tag workflow runs its own checks.

After publication, confirm the PyPI description, metadata links, and downloadable
files. In a fresh environment, run `pip install wagtail-table==0.1.0a1`, then
verify imports and staticfile discovery. Create a GitHub prerelease for the tag,
using the changelog entry as the release notes.

If upload fails, inspect the job before retrying. Published files cannot be
overwritten; fixes to an already published alpha need a new version, such as
`0.1.0a2`. See [PyPI publishing troubleshooting](https://docs.pypi.org/project-management/troubleshooting/).
