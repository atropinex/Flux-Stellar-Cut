import type {ElectronApi} from "./common/CommonInteface";

declare global {
    interface Window {
        api: ElectronApi;
    }
}
