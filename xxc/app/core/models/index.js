import Entity from './entity.js';
import Member from './member.js';
import Chat from './chat.js';
import ChatMessage from './chat-message.js';
import EntitySchema from './entity-schema.js';

/**
 * 返回所有可用的数据库存储类
 * @type {Object}
 * @property {Class} Entity 基础存储实体类
 * @property {Class} Member 成员类
 * @property {Class} Chat 聊天类
 * @property {Class} ChatMessage 聊天消息类
 * @property {Class} EntitySchema 存储实体结构类
 */
export default {
    Entity, Member, Chat, ChatMessage, EntitySchema,
};
