/* ============================================================
 * 服务器配置 — 新增/修改服务器只需改这里
 *
 * type: 'java' | 'bedrock'
 * port: 非默认端口(Java 25565 / 基岩 19132)才需要填
 * demo: 状态接口不可用时的演示回退数据
 * ============================================================ */
var SERVERS = [
    {
        id: 'survival',
        name: '示例生存服',
        icon: 'SV',
        address: 'play.example.com',
        port: 0,
        type: 'java',
        demo: { online: true, players: 12, max: 20, version: '1.20.4', motd: '欢迎来到 示例服务器  Enjoy!', latency: 42 }
    },
    {
        id: 'offline',
        name: '离线测试服',
        icon: 'OF',
        address: 'offline.example.com',
        port: 0,
        type: 'java',
        demo: { online: false, players: 0, max: 0, version: '', motd: '', latency: 0 }
    },
    {
        id: 'bedrock',
        name: '基岩互通服',
        icon: 'BE',
        address: 'bedrock.example.com',
        port: 19132,
        type: 'bedrock',
        demo: { online: true, players: 5, max: 10, version: '1.20.30', motd: '基岩版生存 欢迎加入', latency: 55 }
    }
];
