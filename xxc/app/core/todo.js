import Events from './events.js';

export const createTodo = (data) => {
    const todo = {
        id: `todo-${Date.now()}`,
        createdAt: new Date().getTime(),
        ...data,
    };
    return todo;
};

export const createTodoFromMessage = (message) => {
    const todo = createTodo({
        title: message.content,
        desc: '',
        assignee: message.sender,
        createdBy: message.sender,
        pri: 0,
        status: 'todo',
        message: message.gid,
    });
    return todo;
};

const todo = {
    todos: new Map(),

    add(todo) {
        if (!todo.id) {
            todo.id = `todo-${Date.now()}`;
        }
        this.todos.set(todo.id, todo);
        Events.emit('todo.add', todo);
        return todo;
    },

    remove(todoId) {
        const todo = this.todos.get(todoId);
        if (todo) {
            this.todos.delete(todoId);
            Events.emit('todo.remove', todo);
        }
        return todo;
    },

    update(todo) {
        if (todo && todo.id) {
            this.todos.set(todo.id, todo);
            Events.emit('todo.update', todo);
        }
        return todo;
    },

    get(todoId) {
        return this.todos.get(todoId);
    },

    all() {
        return Array.from(this.todos.values());
    }
};

export default todo;
