import native from './native';
import {ipcOnce} from './remote';
import EVENTS from './remote-events';

/**
 * 截图模块（Electron）
 *
 * [upgrade] contextIsolation 安全模型下，desktopCapturer/screen/Remote.BrowserWindow
 * 不再可直接在渲染进程使用。完整截图切割流程（RecordRTC + desktopCapturer + 裁剪窗口）
 * 较复杂，主流程（登录+主界面）不依赖它，暂保留最小接口与事件契约，
 * 截屏功能完整迁移延后记录为已知限制。
 */

/**
 * 捕获并裁剪屏幕图片
 *
 * 通过主进程事件 EVENT.capture_screen 协调（保留原有事件契约），
 * 完整的 desktopCapturer 抓流 + 裁剪窗口逻辑待后续补全。
 * @param {function} callback 截图完成回调
 * @return {void}
 */
export const captureAndCutScreenImage = (callback) => {
    ipcOnce(EVENTS.capture_screen, (e, image) => {
        if (callback) {
            callback(image);
        }
    });
};

export default {
    captureAndCutScreenImage,
    screen: native.screen,
};
