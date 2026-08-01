// 连通性测试：确认能否访问 Supabase
import dotenv from 'dotenv';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
console.log('测试连接:', url);

try {
  const res = await fetch(url + '/rest/v1/', {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY },
  });
  console.log('✅ 连接成功，HTTP 状态:', res.status);
} catch (err) {
  console.error('❌ 连接失败:', err.message);
  if (err.cause) console.error('   底层原因:', err.cause);
}
