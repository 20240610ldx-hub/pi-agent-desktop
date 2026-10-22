const copy = {
  en: {
    window: "Open in new window", tab: "Open in new browser tab",
    files: "Files popout is not available yet; open files remain in this workspace.",
    terminal: "Terminal popout is not available yet; the current shell stays in this workspace.",
    tasks: "Tasks popout is not available yet; running tasks remain in this workspace.",
    conversation: "Open Changes from the main window; this conversation window does not have native popout permission.",
    missing: "Choose a project folder to open Changes in another view.",
  },
  "zh-CN": {
    window: "在新窗口中打开", tab: "在新浏览器标签页中打开",
    files: "文件面板弹出尚未实现，已打开文件保留在当前工作区。",
    terminal: "终端面板弹出尚未实现，当前 Shell 保留在当前工作区。",
    tasks: "任务面板弹出尚未实现，运行中任务保留在当前工作区。",
    conversation: "请从主窗口弹出更改；此会话窗口没有原生弹出权限。",
    missing: "请选择项目文件夹，再将更改打开到其他视图。",
  },
  "zh-TW": {
    window: "在新視窗中開啟", tab: "在新瀏覽器分頁中開啟",
    files: "檔案面板彈出尚未實作，已開啟檔案保留在目前工作區。",
    terminal: "終端面板彈出尚未實作，目前 Shell 保留在目前工作區。",
    tasks: "任務面板彈出尚未實作，執行中任務保留在目前工作區。",
    conversation: "請從主視窗彈出變更；此對話視窗沒有原生彈出權限。",
    missing: "請先選擇專案資料夾，再將變更開啟到其他檢視。",
  },
};

export const workspacePopoutCopy = (locale: string) => copy[locale as keyof typeof copy] ?? copy.en;
