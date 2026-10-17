import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
try {
  for (const locale of ["en", "zh-CN"]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 840 } });
    try {
      await context.addInitScript(locale => localStorage.setItem("pi-locale", locale), locale);
      let previews = 0; let imports = 0;
      await context.route("**/api/data", async route => {
        const request = route.request();
        let body;
        if (request.method() === "GET") body = { agentDir:"C:/Pilaude/agent", legacyAgentDir:"C:/old/.pi/agent", legacyAvailable:true, credentialStorage:"windows-dpapi" };
        else if (request.postDataJSON().action === "preview") {
          previews++;
          body = { digest:"preview-digest", sourceDir:"C:/old/.pi/agent", targetDir:"C:/Pilaude/agent", files:[{relativePath:"settings.json",conflict:true},{relativePath:"sessions/history.jsonl",conflict:false}],excluded:["auth.json"],warnings:["settings.json: extensions"] };
        } else {
          assert.equal(previews,1); assert.equal(request.postDataJSON().digest,"preview-digest"); imports++;
          body = { imported:["sessions/history.jsonl"], skipped:["settings.json"], backupDir:"C:/Pilaude/agent/import-backups/test" };
        }
        await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      await page.goto("http://127.0.0.1:30141");
      await page.getByRole("button",{name:locale==="en"?"Settings":"设置",exact:true}).first().click();
      const general = page.locator(".settings-entry-menu button",{hasText:locale==="en"?"General":"常规"});
      if(await general.isVisible()) await general.click();
      await page.getByRole("button",{name:locale==="en"?"Preview Pi import":"预览 Pi 数据导入",exact:true}).click();
      await page.getByText("sessions/history.jsonl",{exact:true}).waitFor();
      assert.equal(imports,0,"preview must not start import");
      await page.getByRole("button",{name:locale==="en"?"Back up and import":"备份并导入",exact:true}).click();
      await page.getByText("C:/Pilaude/agent/import-backups/test",{exact:true}).waitFor();
      assert.equal(imports,1);
      await mkdir("test-results/pilaude/data-ui",{recursive:true});
      await page.locator(".pilaude-data-section").screenshot({path:`test-results/pilaude/data-ui/${locale}.png`});
      console.log(`${locale}: preview, explicit import and backup path passed`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
