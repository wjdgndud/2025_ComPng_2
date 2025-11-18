// pollData.js
import { db, auth } from "./firebaseConfig.js";
import {
    collection, 
    doc, 
    getDoc,
    setDoc,
    onSnapshot,
    addDoc,
    runTransaction,
    query,
    orderBy,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

let userUid = null;

// 1. 익명 로그인
export function initAuth() {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                unsubscribe();
                userUid = user.uid;
                console.log("인증 상태 확인됨, UID:", userUid);
                resolve(user);
            } else {
                try {
                    console.log("...인증 정보 없음, 익명 로그인 시도...");
                    await signInAnonymously(auth);
                } catch (error) {
                    console.error("익명 로그인 실패: ", error);
                    reject(error);
                }
            }
        });
    });
}

// 2. 실시간 투표 로드
export async function loadPoll() {
    const pollsDiv = document.getElementById("polls");
    const q = query(collection(db, "polls"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        pollsDiv.innerHTML = ""; // 화면 초기화

        if (snapshot.empty) {
            pollsDiv.innerText = "등록된 투표가 없습니다.";
            return;
        }

        // 모든 문서를 순회하며 투표 정보들를 가져옴
        snapshot.docs.forEach((pollDoc) => {
            const data = pollDoc.data();
            const pollId = pollDoc.id;

            const pollContainer = document.createElement("div");
            pollContainer.className = "poll-container";
            pollContainer.innerHTML = `<h3>${data.question}</h3>`;

            // 버튼 생성
            data.options.forEach((opt, index) => {
                const btn = document.createElement("button");
                btn.textContent = `${opt} (${data.votes[index]}표)`;
                btn.onclick = () => vote(pollId, index);
                pollContainer.appendChild(btn);
            });

            pollsDiv.appendChild(pollContainer);
        }); 
    });
}

// 3. 투표 처리 함수 (1인 1표)
async function vote(pollId, optionIndex) {
    const pollRef = doc(db, "polls", pollId);
    const voteRef = doc(db, "polls", pollId, "votes", userUid);

    const voteSnap = await getDoc(voteRef);
    if (voteSnap.exists()) {
        alert("이미 투표하셨습니다!");
        return;
    }

    try {
        await runTransaction(db, async (transaction) => {
            const pollSnap = await transaction.get(pollRef);
            if (!pollSnap.exists()) {
                throw new Error("투표가 존재하지 않습니다.");
            }
            const pollData = pollSnap.data();
            const newVotes = [...pollData.votes];
            newVotes[optionIndex]++;

            transaction.update(pollRef, { votes: newVotes });
            transaction.set(voteRef, { option: optionIndex, timestamp: new Date() });
        });
        alert("투표 완료!");
    } catch (error) {
        console.error("투표 중 오류 발생: ", error);
        alert("투표 중 오류가 발생했습니다.");
    }
}

export async function createPoll(question, options) {
    const pollsCollection = collection(db, "polls");

    const initialVotes = new Array(options.length).fill(0);

    await addDoc(pollsCollection, {
        question: question,
        options: options,
        votes: initialVotes,
        createdAt: serverTimestamp(),
    });
}
