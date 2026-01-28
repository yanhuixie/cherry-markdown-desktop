引入mermaid

cherry-markdown.js里包含了mermaid（V9.4.3），如果业务方有自己版本的mermaid，则可先使用cherry-markdown.core.js包，然后通过以下三种方式引入自己版本的mermaid。

在线demo
https://tencent.github.io/cherry-markdown/examples/mermaid.html

方式一：定义window.mermaid属性
<...>
  <!-- 默认注入mermaid到window -->
  <script src="https://cdn.com/mermaid/dist/mermaid.min.js"></script>
  <script>
    import mermaidPlugin from 'cherry/dist/addons/cherry-code-block-mermaid-plugin';
    import cherry from 'cherry';
    cherry.usePlugin(mermaidPlugin, {
      mermaid: window.mermaid,
      mermaidAPI: window.mermaid, // 如果mermaid的版本号>10.x，则重置mermaidAPI为mermaid
    }); // 默认从 window.mermaid 获取
    new cherry();
  </script>
</...>

方式二：同步引入mermaid并传值给cherry
import mermaidPlugin from 'cherry/dist/addons/cherry-code-block-mermaid-plugin';
import cherry from 'cherry';
import mermaid from 'mermaid';
cherry.usePlugin(mermaidPlugin, { mermaid });
new cherry();

方式三：异步引入mermaid并传值给cherry
import mermaidPlugin from 'cherry/dist/addons/cherry-code-block-mermaid-plugin';
import cherry from 'cherry';

(async () => {
  const mermaid = await import('mermaid');
  cherry.usePlugin(mermaidPlugin, { mermaid });
  new cherry();
})()

注意
从 mermaid v10.0.0 开始，渲染逻辑由之前的同步渲染改成了异步渲染，afterChange 或者 afterInit 事件后，mermaid 代码块会先渲染为占位符，然后异步渲染并替换。

如需在异步渲染结束后获取内容，可以按以下方式。

const cherryInstance = new Cherry({
  id: 'markdown-container',
  value: '
    ```mermaid
    graph LR
        A[公司] -->| 下 班 | B(菜市场)
        B --> C{看见<br>卖西瓜的}
        C -->|Yes| D[买一个包子]
        C -->|No| E[买一斤包子]
    ```
  ',
  callback: {
    afterAsyncRender: (md, html) => {
      // md 是 markdown 源码，html 是渲染结果
    }
  }
});
