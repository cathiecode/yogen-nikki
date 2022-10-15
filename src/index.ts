import "reflect-metadata";
import { container, inject, injectable } from "tsyringe";
import fastify from "fastify";
import fastifySensible from "@fastify/sensible";
import fastifyCors from "@fastify/cors";

import { add, getUnixTime, nextSunday } from "date-fns";

import { v4 as createV4Uuid } from "uuid";

const IMAGE = {
  UNUPLOADED: "https://example.com/",
  FAILED: "https://example.com/",
} as const;

type PersonalityClass = { outdoor: boolean; extrovert: boolean };

type UserDTO = {
  id: string;
  personalityClass: PersonalityClass;
};

export class User {
  constructor(private data: UserDTO) {}

  getId() {
    return this.data.id;
  }

  getPersonalityClass() {
    return this.data.personalityClass;
  }
}

export class UserService {
  private constructor() {}

  createUser(personalityClass: PersonalityClass): User {
    return new User({
      id: createV4Uuid(),
      personalityClass,
    });
  }

  static instance = new UserService();

  static getInstace() {
    return this.instance;
  }
}

type PostDTO = {
  id: string;
  title: string;
  description: string;
  image: string;
  deadline: number;
  owner: string;
};

class Post {
  constructor(private data: PostDTO) {}

  serialize() {
    return this.data;
  }

  getOwner() {
    return this.data.owner;
  }

  getId() {
    return this.data.id;
  }

  changeImage(image: string) {
    this.data.image = image;
  }

  changeDescription(description: string) {
    this.data.description = description;
  }
}

export class PostService {
  private constructor() {}

  createPost(ownerId: string, personalityClass: PersonalityClass): Post {
    return new Post({
      id: createV4Uuid(),
      title: this.getTitle(personalityClass),
      description: "",
      deadline: this.getDeadline(),
      image: IMAGE.UNUPLOADED,
      owner: ownerId,
    });
  }

  private getDeadline() {
    return getUnixTime(add(nextSunday(new Date()), { days: 1 }));
  }

  private getTitle(personalityClass: PersonalityClass) {
    return `モックの値です(キャラクタクラス: ${personalityClass})`;
  }

  static instance = new PostService();

  static getInstace() {
    return this.instance;
  }
}

interface PostRepository {
  create(post: Post): Promise<void>;
  put(post: Post): Promise<void>;
  findById(postId: string): Promise<Post | null>;
  findByOwnerId(userId: string): Promise<Post[]>;
}

export class MemoryPostRepository implements PostRepository {
  posts = new Map<string, Post>();

  async create(newPost: Post): Promise<void> {
    this.posts.set(newPost.getId(), newPost);
  }

  async put(post: Post): Promise<void> {
    this.posts.set(post.getId(), post);
  }

  async findById(postId: string): Promise<Post | null> {
    return this.posts.get(postId) ?? null;
  }

  async findByOwnerId(id: string): Promise<Post[]> {
    const results = [];
    for (const [_, post] of this.posts.entries()) {
      if (post.getOwner() === id) {
        results.push(post);
      }
    }
    return results;
  }
}

interface UserRepository {
  create(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
}

export class MemoryUserRepository implements UserRepository {
  users = new Map<string, User>();

  async create(newUser: User): Promise<void> {
    this.users.set(newUser.getId(), newUser);
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }
}

interface Usecase<InputData, OutputData> {
  handle(input: InputData): Promise<OutputData>;
}

type CreateAccountUsecaseInput = {
  personalityClass: PersonalityClass;
};

type CreateAccountUsecaseOutput = {
  id: string;
};

type CreateAccountUsecase = Usecase<
  CreateAccountUsecaseInput,
  CreateAccountUsecaseOutput
>;

@injectable()
export class CreateAccountUsecaseInteractor implements CreateAccountUsecase {
  constructor(
    @inject("UserService") private userService: UserService,
    @inject("UserRepository") private userRepository: UserRepository
  ) {}
  async handle(
    input: CreateAccountUsecaseInput
  ): Promise<CreateAccountUsecaseOutput> {
    const newUser = this.userService.createUser(input.personalityClass);
    await this.userRepository.create(newUser);
    return {
      id: newUser.getId(),
    };
  }
}

type AddNewPostUsecaseInput = {
  userId: string;
};

type AddNewPostUsecaseOutput = {
  id: string;
  title: string;
  image: string;
  deadline: number;
};

type AddNewPostUsecase = Usecase<
  AddNewPostUsecaseInput,
  AddNewPostUsecaseOutput
>;

@injectable()
export class AddNewPostUsecaseInteractor implements AddNewPostUsecase {
  constructor(
    @inject("PostService") private postService: PostService,
    @inject("UserRepository") private userRepository: UserRepository,
    @inject("PostRepository") private postRepository: PostRepository
  ) {}

  async handle(
    input: AddNewPostUsecaseInput
  ): Promise<AddNewPostUsecaseOutput> {
    const userPersonality = (
      await this.userRepository.findById(input.userId)
    )?.getPersonalityClass();

    if (!userPersonality) {
      throw new Error("User not found");
    }

    const post = this.postService.createPost(input.userId, userPersonality);
    await this.postRepository.create(post);
    return post.serialize();
  }
}

type GetUserTimelineUsecaseInput = {
  userId: string;
};

type GetUserTimelineUsecaseOutput = {
  list: {
    id: string;
    title: string;
    description: string;
    image: string;
    deadline: number;
  }[];
};

type GetUserTimelineUsecase = Usecase<
  GetUserTimelineUsecaseInput,
  GetUserTimelineUsecaseOutput
>;

@injectable()
export class GetUserTimelineUsecaseInteractor
  implements GetUserTimelineUsecase
{
  constructor(
    @inject("PostRepository") private postRepository: PostRepository
  ) {}
  async handle(
    input: GetUserTimelineUsecaseInput
  ): Promise<GetUserTimelineUsecaseOutput> {
    const result = await this.postRepository.findByOwnerId(input.userId);

    return { list: result.map((post) => post.serialize()) };
  }
}

type EditPostUsecaseInput = {
  postId: string;
  description: string;
  image: string;
};

type EditPostUsecaseOutput = {
  result: {
    id: string;
    title: string;
    description: string;
    image: string;
    deadline: number;
  };
};

type EditPostUsecase = Usecase<EditPostUsecaseInput, EditPostUsecaseOutput>;

@injectable()
export class EditPostUsecaseInteractor implements EditPostUsecase {
  constructor(
    @inject("PostRepository") private postRepository: PostRepository
  ) {}
  async handle(input: EditPostUsecaseInput): Promise<EditPostUsecaseOutput> {
    const post = await this.postRepository.findById(input.postId);
    if (!post) {
      throw new Error("Post not found");
    }

    post.changeImage(input.image);
    post.changeDescription(input.description);

    await this.postRepository.put(post);

    return { result: post.serialize() };
  }
}

@injectable()
class Controller {
  constructor(
    @inject("CreateAccountUsecase")
    private createAccountUsecase: CreateAccountUsecase,
    @inject("AddNewPostUsecase")
    private addNewPostUsecase: AddNewPostUsecase,
    @inject("GetUserTimelineUsecase")
    private getUserTimelineUsecase: GetUserTimelineUsecase,
    @inject("EditPostUsecase")
    private editPostUsecase: EditPostUsecaseInteractor
  ) {}

  createAccount(personalityClass: { outdoor: boolean; extrovert: boolean }) {
    return this.createAccountUsecase.handle({ personalityClass });
  }
  addNewPost(ownerId: string) {
    return this.addNewPostUsecase.handle({
      userId: ownerId,
    });
  }
  async getUserTimeline(userId: string) {
    return (await this.getUserTimelineUsecase.handle({ userId })).list;
  }

  async editPost(postId: string, image: string, description: string) {
    return await this.editPostUsecase.handle({ postId, image, description });
  }
}

function app(controller: Controller) {
  const server = fastify({ logger: true });

  server.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  server.register(fastifySensible);

  server.get("/", async () => {
    return "mirai-nikki-server";
  });

  server.post("/user", async (request) => {
    return {
      uid: (await controller.createAccount(request.body as any)).id, // TODO: バリデーション
    };
  });

  server.post("/post", async (request) => {
    const { uid } = request.body as Record<"uid", unknown>;

    if (typeof uid !== "string") {
      throw server.httpErrors.badRequest;
    }

    try {
      return await controller.addNewPost(uid);
    } catch (e) {
      throw server.httpErrors.internalServerError;
    }
  });

  server.put("/post/:postId", async (request) => {
    const { postId } = request.params as Record<"postId", unknown>;
    const { description, image } = request.params as Record<
      "image" | "description",
      unknown
    >;

    if (typeof postId !== "string") {
      throw server.httpErrors.notFound;
    }

    if (typeof description !== "string" || typeof image !== "string") {
      throw server.httpErrors.badRequest;
    }

    const { result } = await controller.editPost(postId, image, description);
    return result;
  });

  server.post("/posts/by-uid/:uid", async (request) => {
    const { uid } = request.params as Record<"uid", unknown>;

    if (typeof uid !== "string") {
      throw server.httpErrors.notFound;
    }

    try {
      return await controller.getUserTimeline(uid);
    } catch (e) {
      throw server.httpErrors.internalServerError;
    }
  });

  server.listen({ port: parseInt(process.env.PORT ?? "80"), host: "0.0.0.0" });
}

container.register("UserService", { useValue: UserService.getInstace() });
container.register("PostService", { useValue: PostService.getInstace() });
container.register("PostRepository", { useClass: MemoryPostRepository });
container.register("UserRepository", { useValue: new MemoryUserRepository() });
container.register("CreateAccountUsecase", {
  useClass: CreateAccountUsecaseInteractor,
});
container.register("AddNewPostUsecase", {
  useClass: AddNewPostUsecaseInteractor,
});
container.register("GetUserTimelineUsecase", {
  useClass: GetUserTimelineUsecaseInteractor,
});
container.register("EditPostUsecase", { useClass: EditPostUsecaseInteractor });

const controller = container.resolve(Controller);

app(controller);
