# FieldSense AtomS3R 显示端

USB 串口第一版；显示和 JSON 状态解析独立于传输方式，未来 Wi-Fi 接收完整消息后可直接调用 `acceptMessage()`。当前没有实现 Wi-Fi，也没有改动 UNO Q 模型或服务。

## 编译与烧录

使用 PlatformIO，在本目录执行：

```sh
pio run
pio run -t upload --upload-port /dev/cu.usbmodemXXXX
```

用 `pio device list` 查实际端口。首次构建需要下载 ESP32 平台、M5Unified（含 M5GFX）和 ArduinoJson。配置按 M5Stack 官方 AtomS3R PlatformIO 示例使用 ESP32-S3、Octal PSRAM、USB CDC 和 USB Serial/JTAG 模式。第一次烧录如无法连接，按官方说明长按按钮，内部绿灯亮后松开进入下载模式。

烧录后 USB 数据线接 UNO Q 的带供电拓展坞，或先接电脑测试。USB 方式不使用 D0/D1，也不需要 UNO Q 的 MCU Bridge：UNO Q Linux Python 可以直接写 USB 串口。实际板上端口及 App 容器访问权限尚需验证。

## 消息格式 v1

UTF-8 JSON，每条以换行 `\n` 结束，115200 波特率。最大一行 512 字节。发送完整状态快照，每 500 毫秒重复当前状态；不要只在结果变化时发送。合法消息超过 5 秒没有更新时，屏幕显示 NO DATA，隐藏旧结果；这表示数据超时，不一定是物理断线。

```json
{"v":1,"status":"result","label":"common_rust","confidence":0.92}
```

| status | 屏幕含义 |
| --- | --- |
| ready | 对准一片玉米叶 |
| recognizing | 正在识别 |
| result | 显示识别结果 |
| too_close | 请后退 |
| too_far | 请靠近 |
| blurry | 保持稳定，等待对焦 |
| non_target | 未确认玉米目标 |
| too_dark | 增加光线 |
| glare | 调整角度 |
| error | 检查 UNO Q |

result 必须带 label：healthy、common_rust、gray_leaf_spot、northern_leaf_blight。confidence 可省略；若存在，必须是 0–1 的数字。界面将病害标为 SUSPECTED，将分数标为 Model score，不将分数解释为诊断准确率。其他状态不显示旧病害结果。

格式错误、未知状态、无效结果或超长消息被丢弃，不延长超时。没有发送 ACK，USB 输出不混入调试日志。

小屏幕目前使用英文内置字体。拍摄提示只是显示能力：必须由 UNO Q 提供有依据的判断，当前没有自动测距、模糊判断或新增模型。

## 电脑模拟测试

先安装 pyserial，关闭占用端口的串口监视器：

```sh
python3 -m pip install pyserial
python3 tools/send_demo.py /dev/cu.usbmodemXXXX
```

工具每三秒切换一种模拟状态，覆盖四种结果和各类提示。停止工具后，五秒左右应显示 NO DATA；重启发送应恢复。也可以在串口监视器设 115200 和换行，发送上面的单条 JSON；单条消息五秒后超时属于预期行为。

上板检查：依次确认各个文案无截断、四类结果显示、超时隐藏旧结果、重新发送恢复、USB 拔插后恢复。当前尚未在实物上验证。

## 官方参考

- https://docs.m5stack.com/en/core/AtomS3R
- https://docs.m5stack.com/en/arduino/m5atoms3r/program
- https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html

## 验证记录

2026-11-14：PlatformIO 编译成功（ESP32 平台 6.7.0、M5Unified/M5GFX 0.3.0、ArduinoJson 7.4.3）；RAM 23,392 字节，Flash 562,997 字节。模拟工具通过 Python 语法检查。尚未烧录或连接实物验证。

2026-11-14 实物进展：电脑识别到 ESP32-S3 USB 串口 `/dev/cu.usbmodem1101`，固件已成功烧录并通过写入哈希校验；已通过该串口发送 ready、too_far、too_close、blurry、recognizing 及四类 result 模拟消息，发送过程无错误。屏幕实际显示与超时行为仍待使用者目视确认；UNO Q 尚未接入。

使用者随后确认：屏幕正常显示并切换，未报告文字截断。超时切换尚未单独确认。
