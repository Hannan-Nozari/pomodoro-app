import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const output = join(root, 'release')
const config = readFileSync(join(root, 'android/app/build.gradle'), 'utf8')
const version = config.match(/versionName\s+"([\w.-]+)"/)?.[1]
const code = config.match(/versionCode\s+(\d+)/)?.[1]
if (!version || !code) throw new Error('Unable to read Android release version.')
const artifact = `pomodoro-${version}-v${code}`
// Finder's custom folder files are invalid Android resource names. Build in a
// private temporary copy so neither source nor the user's folder icons change.
const staging = mkdtempSync(join(tmpdir(), 'pomodoro-android-'))
const excluded = new Set(['Icon\r', 'build', '.gradle', '.git'])
const env = { ...process.env }
const brewJava = '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home'
if (!env.JAVA_HOME && existsSync(join(brewJava, 'bin/java'))) env.JAVA_HOME = brewJava

try {
  if (!existsSync(join(root, 'android/keystore.properties'))) {
    throw new Error('Configure the existing upload keystore in android/keystore.properties before building a release.')
  }
  for (const name of ['android', 'node_modules']) {
    cpSync(join(root, name), join(staging, name), {
      recursive: true,
      filter: source => !excluded.has(basename(source)),
    })
  }
  const result = spawnSync('./gradlew', ['bundleRelease', 'assembleRelease', 'lintRelease', '--console=plain'], {
    cwd: join(staging, 'android'), env, stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Android build exited with ${result.status}`)
  mkdirSync(output, { recursive: true })
  for (const [source, name] of [
    ['bundle/release/app-release.aab', `${artifact}.aab`],
    ['apk/release/app-release.apk', `${artifact}.apk`],
    ['mapping/release/mapping.txt', 'mapping.txt'],
  ]) {
    cpSync(join(staging, 'android/app/build/outputs', source), join(output, name))
  }
  cpSync(join(staging, 'android/app/build/reports/lint-results-release.html'), join(output, 'lint-results-release.html'))
  console.log(`Signed Android artifacts saved to ${output}`)
} finally {
  // Only this invocation's private staging files are removed. The original
  // keystore and copied deliverables remain in their configured locations.
  rmSync(staging, { recursive: true, force: true })
}
