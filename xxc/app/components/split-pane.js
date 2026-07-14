/**
 * SplitPane 兼容包装组件
 *
 * 用 `react-resizable-panels`（PanelGroup / Panel / PanelResizeHandle）替代已停止维护的
 * `react-split-pane`。保留旧的调用方 API（`split` / `primary` / `minSize` / `maxSize` /
 * `defaultSize` / `paneStyle` / `className`），新旧库的 API 形状差异由本组件适配，不改 Platform 接口。
 *
 * 视觉一致性：沿用原 `.SplitPane` / `.Pane1` / `.Pane2` / `.Resizer` 样式类（见 style/resizer.less、
 * style/mobile.less 中的 `.SplitPane > .Pane1` 等直接子选择器），新库的 DOM 结构
 * （PanelGroup 的 div > Panel 的 div + PanelResizeHandle 的 div + Panel 的 div）映射到这些类名上，
 * 不引入额外包裹层，避免破坏 `> .Pane1` 直接子选择器。
 *
 * 尺寸换算：旧 react-split-pane 的 `defaultSize`/`minSize`/`maxSize` 为像素值；
 * react-resizable-panels 的 `defaultSize`/`minSize`/`maxSize` 为百分比（0-100）。
 * 此处把像素近似换算为百分比（按 800px 宽 / 600px 高的基准估算），保证初始布局与拖拽上下限接近原行为。
 * 精确的像素级约束非渲染关键，故不做 ResizeObserver 动态测量（避免引入额外包裹层破坏 CSS 选择器）。
 * 注意：不能直接在 `PanelGroup` 上设 `ref` 拿 DOM，因其 `ref` 是 imperative handle（非 DOM 元素）。
 */
import React, {Component} from 'react';
import {Panel, PanelGroup, PanelResizeHandle} from 'react-resizable-panels';
import {classes} from '../utils/html-helper';

/**
 * 像素值转百分比（按基准尺寸估算）
 * @param {number} px 像素值
 * @param {number} base 基准尺寸（像素），用于估算占比
 * @param {number} fallback 转换失败时的回退百分比
 * @return {number} 百分比（0-100）
 * @private
 */
const pxToPercent = (px, base, fallback) => {
    if (!px) {
        return fallback;
    }
    return Math.max(0, Math.min(100, (px / base) * 100));
};

export default class SplitPane extends Component {
    static defaultProps = {
        split: 'vertical',
        primary: 'first',
        minSize: 0,
        maxSize: Infinity,
        defaultSize: null,
        paneStyle: null,
        className: null,
        children: null,
    };

    render() {
        const {
            split,
            primary,
            minSize,
            maxSize,
            defaultSize,
            paneStyle,
            className,
            children,
            ...other
        } = this.props;

        // react-split-pane 的 `split` 与 react-resizable-panels 的 `direction` 语义相反：
        // split="vertical"（竖直分隔条、左右两栏） => direction="horizontal"（面板水平排列）
        // split="horizontal"（水平分隔条、上下两栏） => direction="vertical"（面板垂直排列）
        // CSS 类沿用 split 取值以匹配 style/resizer.less 的 .SplitPane.{split} / .Resizer.{split}
        const direction = split === 'vertical' ? 'horizontal' : 'vertical';
        const childrenArray = React.Children.toArray(children);
        const pane1 = childrenArray[0] || null;
        const pane2 = childrenArray[1] || null;

        // primary 决定 defaultSize/minSize/maxSize 作用于哪个面板
        const primaryFirst = primary !== 'second';
        // 基准尺寸：竖直分隔（左右栏）按宽度 800px，水平分隔（上下栏）按高度 600px 估算
        const base = split === 'vertical' ? 800 : 600;
        const minPct = pxToPercent(minSize, base, 0);
        const maxPct = maxSize === Infinity ? 100 : pxToPercent(maxSize, base, 100);
        const defPct = pxToPercent(defaultSize, base, 50);

        // primary 面板受约束，另一面板自动填充
        const primaryPanelProps = {
            minSize: minPct,
            maxSize: maxPct,
            defaultSize: defPct,
        };

        const pane1Props = primaryFirst ? primaryPanelProps : {};
        const pane2Props = primaryFirst ? {} : primaryPanelProps;

        return (
            <PanelGroup
                direction={direction}
                className={classes('SplitPane', className, split)}
                {...other}
            >
                <Panel
                    id="pane1"
                    order={1}
                    className={classes('Pane', 'Pane1', split)}
                    style={paneStyle}
                    {...pane1Props}
                >
                    {pane1}
                </Panel>
                <PanelResizeHandle
                    className={classes('Resizer', split)}
                />
                <Panel
                    id="pane2"
                    order={2}
                    className={classes('Pane', 'Pane2', split)}
                    style={paneStyle}
                    {...pane2Props}
                >
                    {pane2}
                </Panel>
            </PanelGroup>
        );
    }
}
