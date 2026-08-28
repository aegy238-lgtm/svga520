import { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import type { IAgoraRTCClient, IMicrophoneAudioTrack, IRemoteAudioTrack, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';

type IRemoteUser = IAgoraRTCRemoteUser;

export const AGORA_APP_ID = '0070879b369c4918a9e7543966d9a02b';

export function useAgora(roomId: string, userId: string | undefined, isOnMic: boolean) {
  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<IRemoteUser[]>([]);
  const [speakingUsers, setSpeakingUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!roomId || !userId) return;

    let isMounted = true;
    const rtcClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

    const initAgora = async () => {
      rtcClient.enableAudioVolumeIndicator();

      rtcClient.on('volume-indicator', (volumes) => {
        const speaking = volumes.filter(v => v.level > 5).map(v => {
          if (v.uid === 0 || v.uid === '0') return String(userId);
          return String(v.uid);
        });
        setSpeakingUsers(speaking);
      });

      rtcClient.on('user-published', async (user, mediaType) => {
        await rtcClient.subscribe(user, mediaType);
        if (mediaType === 'audio') {
          const remoteAudioTrack = user.audioTrack;
          remoteAudioTrack?.play();
        }
        setRemoteUsers(prev => Array.from(rtcClient.remoteUsers));
      });

      rtcClient.on('user-unpublished', (user, mediaType) => {
        if (mediaType === 'audio') {
          user.audioTrack?.stop();
        }
        setRemoteUsers(prev => Array.from(rtcClient.remoteUsers));
      });

      rtcClient.on('user-joined', (user) => {
        setRemoteUsers(prev => Array.from(rtcClient.remoteUsers));
      });

      rtcClient.on('user-left', (user) => {
        setRemoteUsers(prev => Array.from(rtcClient.remoteUsers));
      });

      try {
        await rtcClient.join(AGORA_APP_ID, roomId, null, userId);
        if (isMounted) {
          setClient(rtcClient);
          setIsJoined(true);
        } else {
          rtcClient.leave();
        }
      } catch (error: any) {
        if (error?.message?.includes('OPERATION_ABORTED') || error?.code === 'OPERATION_ABORTED') {
          console.log('Agora join aborted (component unmounted)');
        } else {
          console.error('Agora join failed:', error);
        }
      }
    };

    initAgora();

    return () => {
      isMounted = false;
      rtcClient.leave();
      setIsJoined(false);
    };
  }, [roomId, userId]);

  useEffect(() => {
    const handleMicState = async () => {
      if (!client || !isJoined) return;

      if (isOnMic) {
        if (!localAudioTrack) {
          try {
            const track = await AgoraRTC.createMicrophoneAudioTrack();
            setLocalAudioTrack(track);
            await client.publish([track]);
          } catch (error: any) {
            console.error('Failed to create or publish audio track:', error);
            if (error?.message?.includes('PERMISSION_DENIED') || error?.message?.includes('NotAllowedError')) {
              alert('يرجى السماح بالوصول إلى الميكروفون للتحدث.');
            }
          }
        }
      } else {
        if (localAudioTrack) {
          localAudioTrack.stop();
          localAudioTrack.close();
          if (client.localTracks.length > 0) {
            await client.unpublish([localAudioTrack]);
          }
          setLocalAudioTrack(null);
        }
      }
    };

    handleMicState();
  }, [isOnMic, client, isJoined]);

  const toggleMute = async () => {
    if (localAudioTrack) {
      const newMutedState = !isMuted;
      await localAudioTrack.setMuted(newMutedState);
      setIsMuted(newMutedState);
    }
  };

  return {
    isJoined,
    isMuted,
    toggleMute,
    remoteUsers,
    speakingUsers,
    client
  };
}
