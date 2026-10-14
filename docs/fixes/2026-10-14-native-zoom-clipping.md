# Windows原生缩放后裁切修复

用户确认E7 Tools正常，epic7-calc缩小后右側面板、操作按钮和伤害结果被裁切。本轮只修改Windows计算器外壳。

根因是App设置的--workspace-viewport-width=100/uiScale vw。原生WebView缩放已经重排CSS视口，再使用倒数补偿会将50%时的页面宽度放大到200vw。旧正式EXE在1200物理像素窗口、50%缩放下，CSS视口1569px，而页面宽度3168px；浏览器CSS zoom布局检查没有覆盖这个原生差异。

修复删除App中的逆比例补偿，计算器、导航和装备页宽度改为calc(100% - 32px)。攻防网格使用可用容器宽度自动排列，较窄窗口的顶部操作区允许换行，避免控制项的最小宽度继续将页面撑出窗口。

验证：207项单元测试及正式EXE构建通过。实际新EXE在1200px/1580px窗口和50%/67%/80%/100%/125%/150%缩放下12组检查通过，包括导航、顶部按钮、攻防面板、伤害表及内部表格边界。50%时同一CSS视口下页面宽度1537.33px，右侧边界1553.33px，处于1569px视口内。装备页面50%不越界，无页面错误。加入npm run test:native-zoom，以隔离副本运行正式EXE，避免只测网页或窗口大小而漏掉内容裁切。

已替换release/Epic7 Damage Calc Portable.exe并更新便携ZIP和SHA256，版本保持0.1.18。原包和前后指标保存于e7-tools/artifacts/native-zoom-fix-2026-10-14。用户的data文件没有被打包操作覆盖；E7 Tools和Android应用代码保持原状。本轮没有上传Release。
