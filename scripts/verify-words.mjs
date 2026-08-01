// 核对导入结果：总数 + 各册数量 + 抽样
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';
import dotenv from 'dotenv';

globalThis.WebSocket = WebSocket;
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { count } = await supabase
  .from('words')
  .select('*', { count: 'exact', head: true });
console.log('数据库总词数:', count);

for (let vol = 1; vol <= 6; vol++) {
  const { count: c } = await supabase
    .from('words')
    .select('*', { count: 'exact', head: true })
    .eq('volume', vol);
  console.log(`  第 ${vol} 册: ${c} 词`);
}

const { data: sample } = await supabase
  .from('words')
  .select('korean, chinese, pos_zh, origin_detail, pronunciation')
  .eq('entry_id', 'v01-c01-u01-005')
  .single();
console.log('\n抽样 (선생님):', JSON.stringify(sample, null, 2));
