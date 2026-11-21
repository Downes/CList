function createP2pHeartbeatView() {
    return {
        expired() {
            console.warn('Heartbeat: session expired — discussion may expire soon.');
            showErrorModal('Your session has expired. Log in again to keep the discussion alive.', { title: 'Session expired' });
        },
        error(error) {
            console.error('Heartbeat failed — discussion may expire if this continues:', error);
            appendMessage('Chat heartbeat failed. The discussion may expire.', false, true);
        }
    };
}
