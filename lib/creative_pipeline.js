/**
 * 创意图片生成管线 - 即梦(dreamina) + 美图(meitu) 降级
 * 修复: CL返回码5 等 CLI 错误提供详细错误信息
 */
const { execSync } = require('child_process');
const path = require('path');

const JIMENG_BIN = process.env.JIMENG_BIN || 'dreamina';
const MEITU_BIN = process.env.MEITU_BIN || 'meitu';

const EXIT_CODE_MAP = {
  1: '通用错误 - 请检查命令参数',
  2: '参数无效 - prompt不能为空',
  3: '认证失败 - 请运行 dreamina login 登录',
  4: '网络错误 - 请检查网络连接',
  5: '服务端拒绝 - API配额用尽或服务不可用，请稍后重试',
  6: '生成超时 - 图片生成耗时过长',
  7: '内容审核拒绝 - prompt包含敏感内容',
  8: '输出格式错误',
};

function describeExitCode(code) {
  return EXIT_CODE_MAP[code] || `未知错误码 ${code}`;
}

function runImage({ action, prompt, imageUrl, provider }) {
  // 自动选择: 先即梦，失败降级美图
  if (provider === 'meitu') {
    return runMeitu({ action, prompt, imageUrl });
  }
  if (provider === 'jimeng') {
    return runJimeng({ action, prompt, imageUrl });
  }

  // auto: 先即梦
  const jimengResult = runJimeng({ action, prompt, imageUrl });
  if (jimengResult.ok) return jimengResult;

  // 即梦失败，降级美图（仅generate）
  if (action === 'generate') {
    const meituResult = runMeitu({ action, prompt, imageUrl });
    if (meituResult.ok) {
      meituResult.fallbackFrom = 'jimeng';
      meituResult.jimengError = jimengResult.error;
      return meituResult;
    }
    // 两个都失败，返回即梦的错误（更详细）
    return jimengResult;
  }

  return jimengResult;
}

function runJimeng({ action, prompt, imageUrl }) {
  try {
    let args;
    const envArgs = process.env.JIMENG_IMAGE_ARGS;

    if (envArgs) {
      try {
        args = JSON.parse(envArgs).map(a => a === '__PROMPT__' ? prompt : a);
      } catch (e) {
        args = ['image-generate', '--prompt', prompt, '--json'];
      }
    } else if (action === 'edit' && imageUrl) {
      args = ['image-edit', '--prompt', prompt, '--image', imageUrl, '--json'];
    } else {
      args = ['image-generate', '--prompt', prompt, '--json'];
    }

    const raw = execSync(`${JIMENG_BIN} ${args.map(a => `"${a}"`).join(' ')}`, {
      timeout: 120000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return { ok: true, raw: raw.trim(), engine: 'jimeng', provider: 'jimeng', error: null };

  } catch (err) {
    const exitCode = err.status || 0;
    const stderr = (err.stderr || '').toString().trim();
    const stdout = (err.stdout || '').toString().trim();

    let errorMsg = `图片生成失败:CL返回码${exitCode}`;
    if (EXIT_CODE_MAP[exitCode]) {
      errorMsg = `图片生成失败:${describeExitCode(exitCode)}`;
    }
    if (stderr) errorMsg += ` - ${stderr.substring(0, 200)}`;

    return {
      ok: false,
      raw: stdout || stderr || '',
      engine: 'jimeng',
      provider: 'jimeng',
      error: errorMsg,
      jimengError: errorMsg,
      exitCode,
    };
  }
}

function runMeitu({ action, prompt, imageUrl }) {
  if (!process.env.MEITU_OPENAPI_ACCESS_KEY) {
    return { ok: false, raw: '', engine: 'meitu', provider: 'meitu', error: '美图API未配置 (MEITU_OPENAPI_ACCESS_KEY)' };
  }

  try {
    const args = action === 'edit' && imageUrl
      ? ['image', 'edit', '--prompt', prompt, '--image', imageUrl, '--json']
      : ['image', 'generate', '--prompt', prompt, '--json'];

    const raw = execSync(`${MEITU_BIN} ${args.map(a => `"${a}"`).join(' ')}`, {
      timeout: 120000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return { ok: true, raw: raw.trim(), engine: 'meitu', provider: 'meitu', error: null };

  } catch (err) {
    const exitCode = err.status || 0;
    const stderr = (err.stderr || '').toString().trim();
    const stdout = (err.stdout || '').toString().trim();

    return {
      ok: false,
      raw: stdout || stderr || '',
      engine: 'meitu',
      provider: 'meitu',
      error: `美图生成失败:退出码${exitCode}${stderr ? ' - ' + stderr.substring(0, 200) : ''}`,
      exitCode,
    };
  }
}

module.exports = { runImage, runJimeng, runMeitu };
