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
import { load } from "https://esm.sh/@fingerprintjs/fingerprintjs@4";

let userUid = null;
let visitorId = null;

// 익명 로그인
export function initAuth() {
    return new Promise((resolve, reject) => {
        // Fingerprint 로드
        load()
            .then(fp => fp.get())
            .then(result => {
                visitorId = result.visitorId;
                console.log("방문자 식별자 생성됨, Visitor ID:", visitorId);
            });

        // Firebase 익명 인증
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

// 실시간 투표 로드
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

            const tags = data.tags || [];
            const tagsDisplay = tags.map(t => `#${t}`).join(" ");
            const tagsAttr = tags.join(",");

            const pollContainer = document.createElement("div");
            pollContainer.className = "poll-container";
            pollContainer.setAttribute("data-tags", tagsAttr);
            pollContainer.innerHTML = `
                <h3>${data.question}</h3>
                <small style="color: #007bff; font-weight: bold;">${tagsDisplay}</small>
            `;

            const optionContainer = document.createElement("div");
            optionContainer.className = "poll-options";

            // 버튼 생성
            data.options.forEach((opt, index) => {
                const btn = document.createElement("button");
                btn.textContent = `${opt} (${data.votes[index]}표)`;
                btn.className = "poll-options button";
                btn.onclick = () => vote(pollId, index);
                optionContainer.appendChild(btn);
            });

            pollContainer.appendChild(optionContainer);
            pollsDiv.appendChild(pollContainer);
        }); 
    });
}

// 투표 처리 함수 (1인 1표)
async function vote(pollId, optionIndex) {
    if (!userUid || !visitorId) {
        alert("인증이 완료되지 않았습니다. 잠시 후 다시 시도해주세요.");
        return;
    }

    const pollRef = doc(db, "polls", pollId);
    const voteRef = doc(db, "polls", pollId, "votes", userUid);
    const fpRef = doc(db, "polls", pollId, "fingerprints", visitorId);

    try {
        await runTransaction(db, async (transaction) => {
            const pollSnap = await transaction.get(pollRef);
            const voteSnap = await transaction.get(voteRef);
            const fpSnap = await transaction.get(fpRef);

            if (!pollSnap.exists()) {
                throw new Error("존재하지 않는 투표입니다.");
            }
            if (voteSnap.exists()) {
                throw new Error("이미 투표한 사용자입니다.");
            }
            if (fpSnap.exists()) {
                throw new Error("이 기기에서 이미 투표가 완료되었습니다.");
            }

            const pollData = pollSnap.data();
            const newVotes = [...pollData.votes];
            newVotes[optionIndex]++;

            transaction.update(pollRef, { votes: newVotes });
            transaction.set(voteRef, { option: optionIndex, timestamp: new Date() });
            transaction.set(fpRef, { votedBy: userUid, timestamp: new Date() });
        });
        alert("투표 완료!");
    } catch (error) {
        console.error("투표 실패:", error);
        alert(error.message);
    }
}

// 새 투표 생성 함수
export async function createPoll(question, options, tags) {
    const pollsCollection = collection(db, "polls");

    const initialVotes = new Array(options.length).fill(0);

    await addDoc(pollsCollection, {
        question: question,
        options: options,
        votes: initialVotes,
        createdAt: serverTimestamp(),
        tags: tags
    });
}

// 그래프용 데이터
export function listenForGraphData(callback) {
    const q = query(collection(db, "polls"), orderBy("createdAt", "desc"))
    onSnapshot(q, (snapshot) => {
        const pollsData = [];
        snapshot.docs.forEach((doc) => {
            const data = doc.data();
            pollsData.push({
                id: doc.id,
                question: data.question,
                tags: data.tags || []
            });
        });
        callback(pollsData);
    });
}