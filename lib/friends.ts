import { supabase } from './supabase';
import { getCurrentUserId } from './currentUser';

// 친구/요청 목록에 쓰는 상대방 정보
export type FriendUser = {
  id: string;
  nickname: string;
};

// 친구 관계 한 건 (화면 표시용). user = 나의 상대방.
export type FriendRow = {
  id: string; // friendships.id
  status: 'pending' | 'accepted';
  user: FriendUser;
};

// 친구 탭에 보여줄 친구의 공개 장소.
// 이름·분류·좌표·친구 한마디만 — 사적 메모(visits.memo)/날짜/사진은 절대 가져오지 않는다.
export type FriendPlace = {
  id: string;
  name: string;
  category_id: string | null;
  latitude: number;
  longitude: number;
  friend_note: string | null;
};

// 친구의 카테고리 (이름·색)
export type FriendCategory = {
  id: string;
  name: string;
  color: string;
};

// 조인으로 따라오는 profiles 한 건 → FriendUser (닉네임 없으면 '사용자')
function toUser(profile: any): FriendUser {
  return { id: profile?.id ?? '', nickname: (profile?.nickname as string) || '사용자' };
}

// friendships + 양쪽 profiles 닉네임을 함께 가져오는 select
const FRIENDSHIP_SELECT =
  'id, requester_id, addressee_id, status, ' +
  'requester:profiles!requester_id(id, nickname), ' +
  'addressee:profiles!addressee_id(id, nickname)';

// 내 초대코드 (profiles.invite_code)
export async function getMyInviteCode(): Promise<string> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('profiles')
    .select('invite_code')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return (data?.invite_code as string) ?? '';
}

// 초대코드로 사용자 찾기 (DB 함수). 없으면 null.
export async function findUserByInvite(code: string): Promise<FriendUser | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase.rpc('find_user_by_invite', { code: trimmed });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { id: row.id, nickname: (row.nickname as string) || '사용자' } : null;
}

// 친구 요청 보내기 (내가 requester, 상대가 addressee, pending)
export async function sendFriendRequest(addresseeId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: userId, addressee_id: addresseeId, status: 'pending' });
  if (error) throw error;
}

// 받은 친구 요청 (내가 addressee, pending) — 상대 = requester
export async function fetchIncomingRequests(): Promise<FriendRow[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('friendships')
    .select(FRIENDSHIP_SELECT)
    .eq('addressee_id', userId)
    .eq('status', 'pending');
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, status: r.status, user: toUser(r.requester) }));
}

// 보낸 친구 요청 (내가 requester, pending) — 상대 = addressee
export async function fetchOutgoingRequests(): Promise<FriendRow[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('friendships')
    .select(FRIENDSHIP_SELECT)
    .eq('requester_id', userId)
    .eq('status', 'pending');
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, status: r.status, user: toUser(r.addressee) }));
}

// 친구 목록 (accepted, 내가 양쪽 어디든) — 상대 = 내가 requester면 addressee, 아니면 requester
export async function fetchFriends(): Promise<FriendRow[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('friendships')
    .select(FRIENDSHIP_SELECT)
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throw error;
  return (data ?? []).map((r: any) => {
    const other = r.requester_id === userId ? r.addressee : r.requester;
    return { id: r.id, status: r.status, user: toUser(other) };
  });
}

// 요청 수락 (status → accepted). RLS가 당사자(addressee)만 허용한다.
export async function acceptRequest(friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId);
  if (error) throw error;
}

// 친구 관계/요청 삭제 — 거절·취소·끊기 공용. RLS가 당사자만 허용한다.
export async function deleteFriendship(friendshipId: string): Promise<void> {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;
}

// 친구가 공개한 장소들 (이름·분류·좌표·한마디). RLS가 친구 공개분(friends/public)만 돌려준다.
// 사적 메모/방문/사진은 가져오지 않는다(visits/visit_photos 조회 자체를 안 함).
export async function fetchFriendPlaces(friendId: string): Promise<FriendPlace[]> {
  const { data, error } = await supabase
    .from('places')
    .select('id, name, category_id, latitude, longitude, friend_note')
    .eq('user_id', friendId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FriendPlace[];
}

// 친구의 카테고리 (이름·색). RLS가 친구 것까지 허용(소셜 단계 확장).
export async function fetchFriendCategories(friendId: string): Promise<FriendCategory[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, color')
    .eq('user_id', friendId);
  if (error) throw error;
  return (data ?? []) as FriendCategory[];
}
