// 小程序运行时的全局声明，供 tsc 类型检查使用（不参与运行）。
declare const wx: any;
declare function Page(options: any): void;
declare function App(options: any): void;
declare function Component(options: any): void;
declare function getApp<T = any>(): T;
declare function getCurrentPages(): any[];
