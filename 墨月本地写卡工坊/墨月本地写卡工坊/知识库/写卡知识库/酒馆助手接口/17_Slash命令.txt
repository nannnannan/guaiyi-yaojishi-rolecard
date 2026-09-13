【Slash命令】
来源: @types/function/slash.d.ts
用途: 运行酒馆的STScript命令(如弹窗提示、刷新页面、触发AI回复等)

════════════════════════════════════════

triggerSlash(command) → Promise<string>

  运行酒馆Slash命令，返回管道结果
  命令写错不会有反馈，出错会抛出异常

  注意: 优先使用酒馆助手接口而非Slash命令!
  Slash命令难以与代码结合，仅在没有对应接口时使用。

  常用命令示例:

    // 弹出通知(但更建议用 toastr.success('成功!'))
    triggerSlash('/echo severity=success 运行成功!');

    // 触发AI回复(先创建用户消息，再触发)
    await createChatMessages([{role:'user', message:'你好'}]);
    await triggerSlash('/trigger');

    // 刷新页面
    triggerSlash('/reload-page');

    // 获取最后一条消息的id(但更建议用 getLastMessageId())
    const id = await triggerSlash('/pass {{lastMessageId}}');

  完整命令列表请参考项目中的 slash_command.txt 文件。
