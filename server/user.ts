import { PubSub } from "graphql-subscriptions";
import { setTimeout } from "timers";

export type UserRecord = {
  id: string;
  name: string;
};

export type UserUpdate =
  | {
      type: "ADD";
      data: { userId: string };
    }
  | {
      type: "CHANGE";
      data: { userId: string };
    }
  | {
      type: "REMOVE";
      data: { userId: string };
    };

export const createUser = ({
  sendUserConnectedMessage,
  sendUserDisconnectedMessage,
}: {
  sendUserConnectedMessage: ({ name }: { name: string }) => void;
  sendUserDisconnectedMessage: ({ name }: { name: string }) => void;
}) => {
  const users = new Map<string, UserRecord>();
  const pubSub = new PubSub();

  const disconnectTimeouts = new Map<string, NodeJS.Timeout>();

  const remove = (id: string) => {
    const user = users.get(id) || null;
    users.delete(id);
    pubSub.publish("USER_UPDATE", { type: "REMOVE", data: { userId: id } });
    return user;
  };

  return {
    userConnects: ({ id, name }: { id: string; name: string }) => {
      // Check whether user has disconnected previously
      let timeout = disconnectTimeouts.get(id);
      if (timeout !== undefined) {
        clearTimeout(timeout);
        disconnectTimeouts.delete(id);
      }

      const user = { id, name };
      users.set(id, user);

      if (timeout === undefined) {
        pubSub.publish("USER_UPDATE", { type: "ADD", data: { userId: id } });
        sendUserConnectedMessage({ name: user.name });
      }
      return user;
    },
    update: ({ id, name }: { id: string; name: string }) => {
      const user = users.get(id);
      if (!user) return;
      user.name = name;
      pubSub.publish("USER_UPDATE", { type: "CHANGE", data: { userId: id } });
    },
    userDisconnects: (id: string) => {
      // When a user disconnects we wait a few seconds before removing him from the list of online users.
      const timeout = setTimeout(() => {
        disconnectTimeouts.delete(id);
        const user = remove(id);
        if (user) {
          sendUserDisconnectedMessage({ name: user.name });
        }
      }, 3000).unref();
      disconnectTimeouts.set(id, timeout);
    },
    get: (id: string) => users.get(id) || null,
    getUsers: () => Array.from(users.values()),
    subscribe: {
      userUpdate: () => pubSub.asyncIterator<UserUpdate>("USER_UPDATE"),
    },
  };
};
