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
  orderBy,
  limit,
  addDoc,
  arrayUnion
} from '@angular/fire/firestore';
import { Observable, distinctUntilChanged, from, map } from 'rxjs';
import { PersonagemDTO } from '../../models/personagem.dto';

/**
 * Service Base para operações com Firestore
 * Fornece operações CRUD genéricas reutilizáveis por todos os services de coleção
 */
@Injectable({ providedIn: 'root' })
export class FirebaseBaseService {
  constructor(private firestore: Firestore) {}

  /**
   * Busca um documento específico por ID
   * @param colecao - Nome da coleção
   * @param id - ID do documento
   * @returns Observable com os dados do documento
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
   * Busca múltiplos documentos com condições (where)
   * @param colecao - Nome da coleção
   * @param constraints - Array de QueryConstraints (where conditions)
   * @returns Observable com array de documentos
   */
  buscar<T>(colecao: string, constraints: QueryConstraint[] = []): Observable<T[]> {
    const q = query(collection(this.firestore, colecao), ...constraints);

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
   * Busca com múltiplas condições
   * @param colecao - Nome da coleção
   * @param campo - Nome do campo para filtrar
   * @param valor - Valor a ser filtrado
   * @returns Observable com array de documentos encontrados
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
   * Busca com múltiplas condições
   * @param colecao - Nome da coleção
   * @param campo - Nome do campo para filtrar
   * @param valor - Valor a ser filtrado
   * @returns Observable com array de documentos encontrados
   */
  buscarPorBuscaveis<T>(colecao: string, valor: any): Observable<T[]> {
    const q = query(collection(this.firestore, colecao), where('buscavelPor', 'array-contains', valor.toLowerCase()));

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

  buscarPersonagemPorPlaca(placa: string, colecao: string): Observable<PersonagemDTO[]> {
    const constraints: QueryConstraint[] = [
      where('placas', 'array-contains', placa)
    ];

    return this.buscarComMultiplosConstrangimentos<PersonagemDTO>(
      colecao,
      constraints
    );
  }

  /**
   * Busca todos os documentos de uma coleção
   * @param colecao - Nome da coleção
   * @returns Observable com todos os documentos
   */
  buscarTodos<T>(colecao: string): Observable<T[]> {
    const ref = collection(this.firestore, colecao);

    const q = query(
      ref,
      orderBy('criadoEm', 'asc') // ou 'desc'
    );

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

  buscarTodosOuvindo<T>(colecao: string): Observable<T[]> {
    const ref = collection(this.firestore, colecao);

    const q = query(
      ref,
      orderBy('criadoEm', 'asc') // ou 'desc'
    );

    return collectionData(q, { idField: 'id' }).pipe(
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    ) as Observable<T[]>;
  }

  /**
   * Cria um novo documento
   * @param colecao - Nome da coleção
   * @param dados - Dados do novo documento (sem incluir 'id')
   * @returns Observable com o ID do documento criado
   */
  criar<T>(colecao: string, id: string, dados: T): Observable<string> {
    var docRef = doc(this.firestore, colecao, id);
    return from(setDoc(docRef, dados as Record<string, any>)).pipe(
      map(docRef => id)
    );
  }

    /**
   * Cria um novo documento
   * @param colecao - Nome da coleção
   * @param dados - Dados do novo documento (sem incluir 'id')
   * @returns Observable com o ID do documento criado
   */
  criarSemId<T>(colecao: string, dados: T): Observable<string> {
    const colRef = collection(this.firestore, colecao);
    return from(addDoc(colRef, dados as any)).pipe(
      map(docRef => docRef.id)
    );
  }

  /**
   * Atualiza um documento existente
   * @param colecao - Nome da coleção
   * @param id - ID do documento
   * @param dados - Dados a atualizar (merge)
   * @returns Observable que completa quando atualização termina
   */
  atualizar<T>(colecao: string, id: string, dados: Partial<T>): Observable<void> {
    return from(updateDoc(doc(this.firestore, colecao, id), dados));
  }

  /**
   * Deleta um documento
   * @param colecao - Nome da coleção
   * @param id - ID do documento
   * @returns Observable que completa quando deleção termina
   */
  deletar(colecao: string, id: string): Observable<void> {
    return from(deleteDoc(doc(this.firestore, colecao, id)));
  }

  atualizarArrayCondicoes(array: any, valor: any) {
    updateDoc(array, {
      condicoes: arrayUnion(valor)
    });
  }

  /**
   * Busca com múltiplas condições usando array de constraints
   * Útil para queries mais complexas
   * @param colecao - Nome da coleção
   * @param constraintsArray - Array de QueryConstraints
   * @returns Observable com array de documentos
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

  buscarPorReferencia<T>(ref: DocumentReference): Observable<T | null> {
    return from(getDoc(ref)).pipe(
      map(snapshot =>
        snapshot.exists()
          ? ({ id: snapshot.id, ...snapshot.data() } as T)
          : null
      )
    );
  }

  buscarProximoProcessamento<T>(idPartida: string, colecao: string): Observable<T[]> {
    const evidenciasRef = collection(
      this.firestore,
      'partidas',
      idPartida,
      colecao
    );

    const q = query(
      evidenciasRef,
      where('status', '==', 'PENDENTE'),
      orderBy('criadoEm', 'asc'),
      limit(1)
    );

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

  async buscarProcessamentosNaoFinalizados(idPartida: string, colecao: string): Promise<any[]> {
    const evidenciasRef = collection(
      this.firestore,
      'partidas',
      idPartida,
      colecao
    );

    const q = query(
      evidenciasRef,
      where('status', 'in', ['PENDENTE', 'PROCESSANDO']),
      orderBy('criadoEm', 'asc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      nome: doc.data()['nome'],
      status: doc.data()['status'],
      criadoEm: doc.data()['criadoEm'],
      tempoDeProcessamento: doc.data()['tempoDeProcessamento'],
      retornarEvidencia: doc.data()['retornarEvidencia'],
      multipla: doc.data()['multipla'],
      tipo: doc.data()['tipo'],
      codigo: doc.data()['codigo']
    }));
  }

  async buscarProcessamentosEmAndamento(idPartida: string, colecao: string): Promise<any[]> {
    const evidenciasRef = collection(
      this.firestore,
      'partidas',
      idPartida,
      colecao
    );

    const q = query(
      evidenciasRef,
      where('status', 'in', ['PROCESSANDO']),
      orderBy('criadoEm', 'asc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      nome: doc.data()['nome'],
      status: doc.data()['status'],
      criadoEm: doc.data()['criadoEm'],
      tempoDeProcessamento: doc.data()['tempoDeProcessamento']
    }));
  }
}
