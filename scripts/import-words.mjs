// 词库导入脚本：把 6 个 CSV 文件导入 Supabase 的 words 表
// 运行方式：node scripts/import-words.mjs

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import WebSocket from 'ws';

// Node 20 缺少原生 WebSocket，补一个（Supabase 新版需要）
if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// 读取本地配置（.env.local）
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ 缺少 SUPABASE_URL 或 SERVICE_ROLE_KEY，请检查 .env.local');
  process.exit(1);
}

// 用 service_role key 创建有写入权限的客户端
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// 词库 CSV 所在文件夹
const VOCAB_DIR = 'D:\\ClaudeWork\\korean\\yonsei_korean_vocabulary';

// 把 CSV 一行转成数据库需要的字段（空字符串转成 null）
function toRow(record) {
  const clean = (v) => (v === undefined || v === '' ? null : v);
  return {
    entry_id: record.entry_id,
    volume: Number(record.volume),
    chapter: Number(record.chapter),
    unit: Number(record.unit),
    sequence: Number(record.sequence),
    korean: record.korean,
    chinese: record.chinese,
    english: clean(record.english),
    pos_zh: clean(record.pos_zh),
    pronunciation: clean(record.pronunciation),
    origin_detail: clean(record.origin_detail),
  };
}

async function main() {
  const allRows = [];

  // 读取 vol-01 到 vol-06
  for (let vol = 1; vol <= 6; vol++) {
    const fileName = `vol-${String(vol).padStart(2, '0')}.csv`;
    const filePath = join(VOCAB_DIR, fileName);
    const content = readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,        // 用表头作为字段名
      skip_empty_lines: true,
      trim: true,
    });
    const rows = records.map(toRow);
    allRows.push(...rows);
    console.log(`📖 ${fileName}: ${rows.length} 个单词`);
  }

  console.log(`\n总计 ${allRows.length} 个单词，开始导入...\n`);

  // 分批导入（每批 500 条，避免请求过大）
  const BATCH = 500;
  let done = 0;
  for (let i = 0; i < allRows.length; i += BATCH) {
    const batch = allRows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('words')
      .upsert(batch, { onConflict: 'entry_id' });
    if (error) {
      console.error(`❌ 第 ${i}–${i + batch.length} 批出错:`, error.message);
      if (error.cause) console.error('   原因:', error.cause);
      process.exit(1);
    }
    done += batch.length;
    console.log(`✅ 已导入 ${done}/${allRows.length}`);
  }

  console.log('\n🎉 全部导入完成！');
}

main();
