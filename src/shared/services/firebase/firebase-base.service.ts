import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  QueryConstraint,
  DocumentReference,
  collectionData,
  docData,
  orderBy,
  addDoc
} from '@angular/fire/firestore';
import { Observable, distinctUntilChanged, from, map } from 'rxjs';

/**
 * Service Base para operações com Firestore
 * Fornece operações CRUD genéricas reutilizáveis por todos os services de coleção
 */
@Injectable({ providedIn: 'root' })
export class FirebaseBaseService {
  constructor(private firestore: Firestore) {}

  /**
   * Busca um documento específico por ID
   */
  buscarPorId<T>(colecao: string, id: string): Observable<T | null> {
    return from(
      getDoc(doc(this.firestore, colecao, id))
    ).pipe(
      map(docSnapshot => {
        if (docSnapshot.exists()) {
          return { id: docSnapshot.id, ...docSnapshot.data() } as T;
        }
        return null;
      })
    );
  }

  /**
   * Escuta em tempo real um único documento por ID — versão "ao vivo" de
   * buscarPorId. Some sozinha quando o observable é desinscrito (ex.: o
   * componente que a usa via toSignal/toObservable é destruído), então não
   * precisa de limpeza manual.
   */
  buscarPorIdOuvindo<T>(colecao: string, id: string): Observable<T | null> {
    return docData(doc(this.firestore, colecao, id), { idField: 'id' }).pipe(
      map(dados => (dados ?? null) as T | null)
    );
  }

  /**
   * Busca múltiplos documentos filtrando por um único campo
   */
  buscarPorCampo<T>(colecao: string, campo: string, valor: any): Observable<T[]> {
    const q = query(collection(this.firestore, colecao), where(campo, '==', valor));

    return from(getDocs(q)).pipe(
      map(querySnapshot => {
        const dados: T[] = [];
        querySnapshot.forEach(doc => {
          dados.push({ id: doc.id, ...doc.data() } as T);
        });
        return dados;
      })
    );
  }

  /**
   * Busca com múltiplas condições (array de QueryConstraints)
   */
  buscarComMultiplosConstrangimentos<T>(
    colecao: string,
    constraintsArray: QueryConstraint[]
  ): Observable<T[]> {
    const q = query(collection(this.firestore, colecao), ...constraintsArray);

    return from(getDocs(q)).pipe(
      map(querySnapshot => {
        const dados: T[] = [];
        querySnapshot.forEach(doc => {
          dados.push({ id: doc.id, ...doc.data() } as T);
        });
        return dados;
      })
    );
  }

  /**
   * Escuta em tempo real os documentos que casam com múltiplas condições
   * (array de QueryConstraints). Versão "ao vivo" de
   * buscarComMultiplosConstrangimentos, para listas que precisam refletir
   * criações/edições imediatamente, sem esperar um refetch manual.
   */
  buscarComMultiplosConstrangimentosOuvindo<T>(
    colecao: string,
    constraintsArray: QueryConstraint[]
  ): Observable<T[]> {
    const q = query(collection(this.firestore, colecao), ...constraintsArray);

    return collectionData(q, { idField: 'id' }).pipe(
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    ) as Observable<T[]>;
  }

  /**
   * Busca todos os documentos de uma coleção, ordenados por criadoEm
   */
  buscarTodos<T>(colecao: string): Observable<T[]> {
    const ref = collection(this.firestore, colecao);
    const q = query(ref, orderBy('criadoEm', 'asc'));

    return from(getDocs(q)).pipe(
      map(querySnapshot => {
        const dados: T[] = [];
        querySnapshot.forEach(doc => {
          dados.push({ id: doc.id, ...doc.data() } as T);
        });
        return dados;
      })
    );
  }

  /**
   * Busca todos os documentos de uma coleção e escuta mudanças em tempo real
   */
  buscarTodosOuvindo<T>(colecao: string): Observable<T[]> {
    const ref = collection(this.firestore, colecao);
    const q = query(ref, orderBy('criadoEm', 'asc'));

    return collectionData(q, { idField: 'id' }).pipe(
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    ) as Observable<T[]>;
  }

  /**
   * Escuta em tempo real os documentos que casam com um campo, ordenados
   * por criadoEm decrescente (mais recente primeiro). Usado por listas
   * que pertencem a um único dono (ex: pedidos de um usuário).
   */
  buscarPorCampoOuvindo<T>(colecao: string, campo: string, valor: any): Observable<T[]> {
    const q = query(
      collection(this.firestore, colecao),
      where(campo, '==', valor),
      orderBy('criadoEm', 'desc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    ) as Observable<T[]>;
  }

  /**
   * Cria um novo documento com ID definido
   */
  criar<T>(colecao: string, id: string, dados: T): Observable<string> {
    const docRef = doc(this.firestore, colecao, id);
    return from(setDoc(docRef, this.semUndefined(dados) as Record<string, any>)).pipe(
      map(() => id)
    );
  }

  /**
   * Cria ou atualiza parcialmente um documento (upsert). Útil para documentos
   * "de configuração" que podem não existir ainda (ex: perfil, carrinho ativo).
   */
  salvarComMerge<T>(colecao: string, id: string, dados: Partial<T>): Observable<void> {
    const docRef = doc(this.firestore, colecao, id);
    return from(setDoc(docRef, this.semUndefined(dados) as Record<string, any>, { merge: true }));
  }

  /**
   * Cria um novo documento com ID gerado automaticamente
   */
  criarSemId<T>(colecao: string, dados: T): Observable<string> {
    const colRef = collection(this.firestore, colecao);
    return from(addDoc(colRef, this.semUndefined(dados) as any)).pipe(
      map(docRef => docRef.id)
    );
  }

  /**
   * Atualiza um documento existente (merge parcial)
   */
  atualizar<T>(colecao: string, id: string, dados: Partial<T>): Observable<void> {
    return from(updateDoc(doc(this.firestore, colecao, id), this.semUndefined(dados)));
  }

  /**
   * Remove campos com valor undefined antes de gravar — o SDK do Firestore
   * rejeita a escrita inteira (addDoc/setDoc/updateDoc) se algum campo vier
   * undefined, o que acontece toda vez que um campo opcional do formulário
   * é deixado em branco (ex: "campo || undefined").
   */
  private semUndefined<T>(dados: T): T {
    const resultado = { ...(dados as Record<string, any>) };
    for (const chave of Object.keys(resultado)) {
      if (resultado[chave] === undefined) {
        delete resultado[chave];
      }
    }
    return resultado as T;
  }

  /**
   * Deleta um documento
   */
  deletar(colecao: string, id: string): Observable<void> {
    return from(deleteDoc(doc(this.firestore, colecao, id)));
  }

  /**
   * Busca um documento a partir de uma referência já resolvida
   */
  buscarPorReferencia<T>(ref: DocumentReference): Observable<T | null> {
    return from(getDoc(ref)).pipe(
      map(snapshot =>
        snapshot.exists()
          ? ({ id: snapshot.id, ...snapshot.data() } as T)
          : null
      )
    );
  }
}
