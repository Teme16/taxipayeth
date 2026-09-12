import {
    createContext,
    useContext,
    useEffect,
    useState
} from 'react';

import {
    io
} from 'socket.io-client';

import {
    useAuth
} from './AuthContext';

const SocketContext =
    createContext(null);

export const SocketProvider = ({
    children
}) => {
    const { user } = useAuth();

    const [socket, setSocket] =
        useState(null);

    const [connected, setConnected] =
        useState(false);

    useEffect(() => {
        const token =
            localStorage.getItem(
                'taxipay_token'
            );

        if (!user || !token) {
            return undefined;
        }

        const instance = io(
            import.meta.env.VITE_SOCKET_URL ||
            'https://taxipayeth.onrender.com',
            {
                auth: {
                    token
                },
                transports: [
                    'websocket',
                    'polling'
                ]
            }
        );

        instance.on(
            'connect',
            () => setConnected(true)
        );

        instance.on(
            'disconnect',
            () => setConnected(false)
        );

        instance.on(
            'connect_error',
            () => setConnected(false)
        );

        setSocket(instance);

        return () => {
            instance.disconnect();
            setSocket(null);
            setConnected(false);
        };
    }, [user]);

    return (
        <SocketContext.Provider
            value={{
                socket,
                connected
            }}
        >
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    const context =
        useContext(SocketContext);

    if (!context) {
        throw new Error(
            'useSocket must be used inside SocketProvider.'
        );
    }

    return context;
};
