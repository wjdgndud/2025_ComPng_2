// pollData.js
import { db, auth } from "./firebaseConfig.js";

import {
    collection, doc, getDoc, setDoc, deleteDoc, updateDoc,
    onSnapshot, addDoc, runTransaction, query, orderBy, serverTimestamp,
    getDocs, writeBatch
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { load } from "https://esm.sh/@fingerprintjs/fingerprintjs@4";

let userUid = null;
let visitorId = null;

// 1. Fingerprint 생성 및 Firebase 익명 인증 + ID 화면 표시
export async function initAuth() {
    return new Promise(async (resolve, reject) => {
        try {
            // Fingerprint 생성
            const fp = await load();
            const result = await fp.get();
            visitorId = result.visitorId;

            // Firebase 익명 인증 처리
            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                if (user) {
                    unsubscribe();
                    userUid = user.uid;

                    // 화면 하단에 ID 정보 안전하게 표시 (textContent 사용)
                    const infoBar = document.getElementById("user-info-bar");
                    if (infoBar) {
                        infoBar.innerHTML = ""; // 초기화
                        
                        infoBar.style.display = "flex";
                        infoBar.style.justifyContent = "center";
                        infoBar.style.gap = "15px";

                        // User UID
                        const uidWrapper = document.createElement("span");
                        const uidLabel = document.createElement("strong");
                        uidLabel.textContent = "User UID: ";
                        const uidValue = document.createTextNode(userUid.slice(0, 10) + "...");
                        uidWrapper.appendChild(uidLabel);
                        uidWrapper.appendChild(uidValue);

                        // 구분선
                        const separator = document.createElement("span");
                        separator.textContent = "|";
                        separator.style.color = "#ccc";

                        // Visitor ID
                        const visitorWrapper = document.createElement("span");
                        const visitorLabel = document.createElement("strong");
                        visitorLabel.textContent = "Visitor ID: ";
                        const visitorValue = document.createTextNode(visitorId);
                        visitorWrapper.appendChild(visitorLabel);
                        visitorWrapper.appendChild(visitorValue);

                        infoBar.appendChild(uidWrapper);
                        infoBar.appendChild(separator);
                        infoBar.appendChild(visitorWrapper);
                    }

                    resolve(user);
                } else {
                    try { await signInAnonymously(auth); } 
                    catch (error) { reject(error); }
                }
            });
        } catch (error) {
            return reject(error);
        }
    });
}

// 2. 실시간 투표 로드 (기기 ID로도 투표 여부 확인)
export async function loadPoll() {
    const pollsDiv = document.getElementById("polls");
    const q = query(collection(db, "polls"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            pollsDiv.innerText = "등록된 투표가 없습니다.";
            return;
        }

        let docs = [];
        snapshot.docs.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
        docs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

        const activeIds = new Set();

        docs.forEach((data) => {
            const pollId = data.id;
            activeIds.add(pollId);

            let pollContainer = document.getElementById(pollId);
            const isExisting = !!pollContainer;

            if (!isExisting) {
                // (A) 없으면 새로 만들기
                pollContainer = document.createElement("div");
                pollContainer.id = pollId;
                pollContainer.className = "poll-container";
                
                const headerDiv = document.createElement("div");
                headerDiv.className = "poll-header";
                
                const contentDiv = document.createElement("div");
                contentDiv.className = "poll-header-content";
                
                const questionEl = document.createElement("h3");
                questionEl.className = "poll-question";
                
                const tagsEl = document.createElement("small");
                tagsEl.className = "poll-tags";

                contentDiv.appendChild(questionEl);
                contentDiv.appendChild(tagsEl);
                headerDiv.appendChild(contentDiv);

                const resultBtn = document.createElement("button");
                resultBtn.className = "result-btn";
                resultBtn.textContent = "결과 보기";
                resultBtn.onclick = () => {
                    import("./chartView.js").then(module => module.showVoteChart(pollId));
                };
                headerDiv.appendChild(resultBtn);

                if (userUid && data.ownerId === userUid) {
                    const btnDiv = document.createElement("div");
                    btnDiv.className = "poll-manage-btns";
                    btnDiv.innerHTML = `<button class="edit-btn">수정</button><button class="delete-btn">삭제</button>`;
                    btnDiv.querySelector(".edit-btn").onclick = () => window.editPoll(pollId);
                    btnDiv.querySelector(".delete-btn").onclick = () => window.deletePoll(pollId);
                    headerDiv.appendChild(btnDiv);
                }
                pollContainer.appendChild(headerDiv);

                const optionContainer = document.createElement("div");
                optionContainer.className = "poll-options";
                pollContainer.appendChild(optionContainer);

                pollsDiv.appendChild(pollContainer);
            }

            // (B) 내용 업데이트
            const tags = data.tags || [];
            pollContainer.setAttribute("data-tags", tags.join(","));
            pollContainer.querySelector(".poll-question").textContent = data.question;
            pollContainer.querySelector(".poll-tags").textContent = tags.map(t => `#${t}`).join(" ");

            const optionContainer = pollContainer.querySelector(".poll-options");
            optionContainer.innerHTML = ""; 

            data.options.forEach((opt, index) => {
                const btn = document.createElement("button");
                btn.textContent = opt; 
                btn.className = "poll-options button";
                btn.onclick = async () => {
                    await vote(pollId, index);
                    document.dispatchEvent(new CustomEvent("pollVoted", {detail: pollId}));
                };
                optionContainer.appendChild(btn);
            });

            // 투표 여부 확인 (계정 OR 기기)
            if (userUid && visitorId) {
                const checkMyVote = async () => {
                    // 1. 내 계정(UID)으로 투표했는지 확인
                    const voteRef = doc(db, "polls", pollId, "votes", userUid);
                    const voteSnap = await getDoc(voteRef);

                    if (voteSnap.exists()) {
                        return voteSnap.data().option; // 찾았으면 인덱스 반환
                    }

                    // 2. 계정 기록 없으면, 내 기기(Fingerprint)로 투표했는지 확인
                    const fpRef = doc(db, "polls", pollId, "fingerprints", visitorId);
                    const fpSnap = await getDoc(fpRef);

                    // 기기 기록에 'option' 필드가 있는 경우에만 반환
                    if (fpSnap.exists() && fpSnap.data().option !== undefined) {
                        return fpSnap.data().option; 
                    }
                    
                    return -1; // 투표 안 함
                };

                checkMyVote().then((myIndex) => {
                    if (myIndex !== -1) {
                        const btns = optionContainer.querySelectorAll("button");
                        if (btns[myIndex]) {
                            btns[myIndex].classList.add("selected");
                        }
                    }
                });
            }

            pollsDiv.appendChild(pollContainer);
        });

        Array.from(pollsDiv.children).forEach(child => {
            if (child.id && !activeIds.has(child.id)) {
                child.remove();
            }
        });
    });
}

// 3. 투표 처리
async function vote(pollId, optionIndex) {
    if (!userUid || !visitorId) return alert("로딩 중입니다.");
    
    const pollRef = doc(db, "polls", pollId);
    const voteRef = doc(db, "polls", pollId, "votes", userUid);
    const fpRef = doc(db, "polls", pollId, "fingerprints", visitorId);

    try {
        await runTransaction(db, async (transaction) => {
            const pollSnap = await transaction.get(pollRef);
            const voteSnap = await transaction.get(voteRef);
            const fpSnap = await transaction.get(fpRef);

            if (!pollSnap.exists()) throw "투표가 없습니다.";
            if (voteSnap.exists()) throw "이미 투표했습니다.";
            if (fpSnap.exists()) throw "이 기기에서 이미 투표했습니다.";

            const pollData = pollSnap.data();
            const newVotes = [...pollData.votes];
            newVotes[optionIndex]++;

            transaction.update(pollRef, { votes: newVotes });
            
            // 계정 기록 저장
            transaction.set(voteRef, { option: optionIndex, timestamp: new Date() });
            
            // ▼▼▼ [핵심 수정] 기기 기록에도 'option' 저장 ▼▼▼
            transaction.set(fpRef, { 
                votedBy: userUid, 
                option: optionIndex, // 옵션 인덱스 추가 저장
                timestamp: new Date() 
            });
        });
        alert("투표 완료!");
    } catch (err) {
        console.error(err);
        alert(typeof err === "string" ? err : "투표 실패");
    }
}

// 4. 투표 생성
export async function createPoll(question, options, tags) {
    await addDoc(collection(db, "polls"), {
        question, options, tags,
        votes: new Array(options.length).fill(0),
        createdAt: serverTimestamp(),
        ownerId: userUid
    });
}

// 5. 투표 삭제
window.deletePoll = async (pollId) => {
    if (!confirm("정말로 삭제하시겠습니까?")) return;
    try {
        await deleteDoc(doc(db, "polls", pollId));
        alert("삭제되었습니다.");
    } catch (e) {
        console.error(e);
        alert("삭제 권한이 없습니다.");
    }
};

// 6. 투표 수정
window.editPoll = async (pollId) => {
    try {
        const pollRef = doc(db, "polls", pollId);
        const snap = await getDoc(pollRef);
        if (!snap.exists()) return alert("투표가 존재하지 않습니다.");
        
        const data = snap.data();

        const newQ = prompt("수정할 질문을 입력하세요 (50자 이내):", data.question);
        if (newQ === null) return;
        const cleanQ = newQ.trim();
        if (!cleanQ || cleanQ.length > 50) return alert("질문은 1자 이상 50자 이하로 입력해야 합니다.");

        const oldOptionsStr = data.options.join(",");
        const newOptionsStr = prompt("수정할 옵션을 콤마로 구분해 입력하세요 (2~10개, 각 20자 이내):", oldOptionsStr);
        if (newOptionsStr === null) return;

        let cleanOptions = newOptionsStr.split(",").map(t => t.trim()).filter(t => t.length > 0);
        if (new Set(cleanOptions).size !== cleanOptions.length) return alert("중복된 옵션이 있습니다.");
        if (cleanOptions.length < 2 || cleanOptions.length > 10) return alert("옵션은 2개~10개 사이여야 합니다.");
        if (cleanOptions.some(opt => opt.length > 20)) return alert("각 옵션은 20자 이내여야 합니다.");

        const oldTagsStr = (data.tags || []).join(",");
        const newTagsStr = prompt("수정할 태그를 입력하세요 (최대 5개, 각 10자 이내):", oldTagsStr);
        if (newTagsStr === null) return;

        let cleanTags = newTagsStr.split(",").map(t => t.trim()).filter(t => t.length > 0);
        cleanTags = [...new Set(cleanTags)];
        if (cleanTags.length > 5) return alert("태그는 최대 5개입니다.");
        if (cleanTags.some(t => t.length > 10)) return alert("태그는 10자 이내여야 합니다.");
        if (cleanTags.some(tag => /[^a-zA-Z0-9가-힣\s]/.test(tag))) return alert("태그에는 특수문자를 사용할 수 없습니다.");

        const isQuestionSame = cleanQ === data.question;
        const isOptionsSame = JSON.stringify(cleanOptions) === JSON.stringify(data.options);
        const isTagsSame = JSON.stringify(cleanTags) === JSON.stringify(data.tags);

        if (isQuestionSame && isOptionsSame && isTagsSame) {
            return alert("변경된 내용이 없습니다.");
        }

        let finalVotes = data.votes;
        const needsReset = !isQuestionSame || !isOptionsSame;

        if (needsReset) {
            const warningMsg = !isQuestionSame 
                ? "⚠️ 질문 내용이 변경되어 투표의 의미가 달라질 수 있습니다." 
                : "⚠️ 옵션 내용이 변경되었습니다.";
            
            const confirmReset = confirm(
                `${warningMsg}\n공정성을 위해 기존 투표 기록이 0으로 초기화됩니다.\n\n정말 수정하시겠습니까?`
            );
            
            if (!confirmReset) return;

            finalVotes = new Array(cleanOptions.length).fill(0);

            const batch = writeBatch(db);
            
            // votes 서브 컬렉션 삭제 (참조 재생성 방식)
            const votesSnapshot = await getDocs(collection(db, "polls", pollId, "votes"));
            votesSnapshot.forEach((vDoc) => {
                const ref = doc(db, "polls", pollId, "votes", vDoc.id);
                batch.delete(ref);
            });

            // fingerprints 서브 컬렉션 삭제 (참조 재생성 방식)
            const fpSnapshot = await getDocs(collection(db, "polls", pollId, "fingerprints"));
            fpSnapshot.forEach((fpDoc) => {
                const ref = doc(db, "polls", pollId, "fingerprints", fpDoc.id);
                batch.delete(ref);
            });

            await batch.commit();
        }

        await updateDoc(pollRef, {
            question: cleanQ,
            options: cleanOptions,
            tags: cleanTags,
            votes: finalVotes
        });
        
        alert("성공적으로 수정되었습니다.");

    } catch (e) {
        console.error(e);
        alert("수정 권한이 없거나 오류가 발생했습니다.");
    }
};

// 7. 그래프 데이터 가져오는 함수
export function listenForGraphData(callback) {
    const q = query(collection(db, "polls"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        const pollsData = [];
        snapshot.docs.forEach(doc => pollsData.push({ id: doc.id, ...doc.data() }));
        callback(pollsData);
    });
}