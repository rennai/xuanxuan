import {showChatCodeDialog} from './chats/chat-send-code-dialog.jsx';
import {showChatShareDialog} from './chats/chat-share-dialog.jsx';
import {registerCommand} from '../core/commander.js';
import {getChat} from '../core/im/im-chats.js';
import {getCurrentActiveChatGID} from '../core/im/im-ui.js';

export default () => {
    registerCommand('showChatSendCodeDialog', (context, chat) => {
        chat = chat || context.chat || getCurrentActiveChatGID(); // eslint-disable-line
        if (typeof chat === 'string') {
            chat = getChat(chat);
        }
        if (!chat) {
            return;
        }
        showChatCodeDialog(chat);
    });

    registerCommand('showChatShareDialog', (context) => {
        const {message} = context;
        showChatShareDialog(message);
    });
};
