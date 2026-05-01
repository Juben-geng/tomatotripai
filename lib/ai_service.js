/**
 * AI聊天服务 - 多平台统一接口
 */
class UnifiedAIService {
  getPlatformStatus() {
    const platforms = [];
    if (process.env.ANTHROPIC_API_KEY) platforms.push({ name: 'Claude', status: 'ready' });
    if (process.env.OPENAI_API_KEY) platforms.push({ name: 'OpenAI', status: 'ready' });
    if (platforms.length === 0) platforms.push({ name: 'mock', status: 'fallback' });
    return platforms;
  }

  async chat(message, options = {}) {
    const { mode, history, context } = options;

    // Check for Anthropic SDK
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      if (process.env.ANTHROPIC_API_KEY) {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const messages = (history || []).map(h => ({
          role: h.role || 'user',
          content: h.content || '',
        }));
        messages.push({ role: 'user', content: message });

        const response = await client.messages.create({
          model: 'claude-sonnet-4-6-20250514',
          max_tokens: 2000,
          messages,
          system: '你是番茄旅行AI助手，一个专业的旅游顾问。帮助用户查询酒店、机票、门票等信息。',
        });

        const text = response.content && response.content[0] ? response.content[0].text : '';
        return {
          status: 0,
          message: text,
          platform: 'claude',
          usage: response.usage,
        };
      }
    } catch (e) {
      // Anthropic SDK not available or API key not set
    }

    // Fallback: mock response
    return {
      status: 0,
      message: `番茄旅行AI助手回复：收到您的消息"${message.substring(0, 50)}..."。我正在开发中，请稍后重试或配置 ANTHROPIC_API_KEY 启用AI对话。`,
      platform: 'mock',
      usage: null,
    };
  }
}

module.exports = { UnifiedAIService };
